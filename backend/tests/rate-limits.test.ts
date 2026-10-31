import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { Hono } from "hono";
import { every } from "hono/combine";
import { and, eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { notifications } from "../src/db/schema.js";
import { notifyPoster } from "../src/lib/mailer.js";
import { getClientIp, rateLimitAddress } from "../src/lib/clientIp.js";
import { buildLimiter, limitKeys } from "../src/middleware/limiters.js";
import { MAX_STREAMS_PER_USER, subscribe, unsubscribe } from "../src/lib/notifications/notificationStream.js";
import type { SSEStreamingApi } from "hono/streaming";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

// The address the app works out for a request with these headers.
async function ipFor(headers: Record<string, string>) {
  const probe = new Hono().get("/", (c) => c.text(getClientIp(c)));
  return (await probe.request("/", { headers })).text();
}

describe("the visitor's address", () => {
  it("takes Cloudflare's CF-Connecting-IP first", async () => {
    expect(await ipFor({ "cf-connecting-ip": "49.43.200.26", "x-forwarded-for": "1.2.3.4, 10.28.128.162" })).toBe(
      "49.43.200.26"
    );
  });

  // What Render showed in October 2026: its own internal hop last.
  it("skips Render's internal hop at the end of X-Forwarded-For", async () => {
    expect(await ipFor({ "x-forwarded-for": "49.43.200.26, 10.28.128.162" })).toBe("49.43.200.26");
  });

  it("can't be set by a client writing to the start of X-Forwarded-For", async () => {
    expect(await ipFor({ "x-forwarded-for": "1.2.3.4, 49.43.200.26, 10.28.128.162" })).toBe("49.43.200.26");
  });

  it("ignores a CF-Connecting-IP that isn't an address", async () => {
    expect(await ipFor({ "cf-connecting-ip": "nonsense", "x-forwarded-for": "49.43.200.26" })).toBe("49.43.200.26");
  });

  it("counts a whole IPv6 /64 as one visitor", () => {
    const a = rateLimitAddress("2409:4091:808b:8c03:f92f:c68e:cfd1:340a");
    const b = rateLimitAddress("2409:4091:808b:8c03::1");
    expect(a).toBe("2409:4091:808b:8c03::/64");
    expect(b).toBe(a);
    expect(rateLimitAddress("2409:4091:808b:8c04::1")).not.toBe(a);
    expect(rateLimitAddress("49.43.200.26")).toBe("49.43.200.26");
  });
});

// The limits are off in the test environment (every request there shares one
// address), so these build the same limiters the app uses and run them on a
// small app of their own.
describe("limiters", () => {
  const from = (ip: string, body?: unknown) => ({
    method: "POST",
    headers: { "cf-connecting-ip": ip, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  it("answers over the limit with a 429 in the usual shape, saying when to retry", async () => {
    const limited = new Hono().post(
      "/",
      buildLimiter({ windowMs: 60_000, limit: 2, key: limitKeys.byAddress, message: "Slow down." }),
      (c) => c.json({ ok: true })
    );
    await limited.request("/", from("49.43.200.26"));
    await limited.request("/", from("49.43.200.26"));
    const res = await limited.request("/", from("49.43.200.26"));

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Slow down." });
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("keeps separate counts for separate visitors", async () => {
    const limited = new Hono().post(
      "/",
      buildLimiter({ windowMs: 60_000, limit: 1, key: limitKeys.byAddress, message: "Slow down." }),
      (c) => c.json({ ok: true })
    );
    expect((await limited.request("/", from("49.43.200.26"))).status).toBe(200);
    expect((await limited.request("/", from("49.43.200.27"))).status).toBe(200);
    expect((await limited.request("/", from("49.43.200.26"))).status).toBe(429);
  });

  it("counts only failures when asked to, so successful logins use nothing up", async () => {
    const login = new Hono().post(
      "/",
      // Combined as the app's login limiter is, so each one sees the result.
      every(
        buildLimiter({ windowMs: 60_000, limit: 100, key: limitKeys.byAddress, message: "Network.", onlyFailures: true }),
        buildLimiter({ windowMs: 60_000, limit: 2, key: limitKeys.byEmailAndAddress, message: "Wait.", onlyFailures: true })
      ),
      async (c) => {
        const { password } = await c.req.json();
        return password === "right" ? c.json({ ok: true }) : c.json({ error: "wrong" }, 401);
      }
    );
    const attempt = (password: string) => login.request("/", from("49.43.200.26", { email: "a@x.com", password }));

    for (let i = 0; i < 5; i++) expect((await attempt("right")).status).toBe(200);
    expect((await attempt("bad")).status).toBe(401);
    expect((await attempt("bad")).status).toBe(401);
    expect((await attempt("bad")).status).toBe(429);
  });

  it("limits by the email address across networks, and the route can still read the body", async () => {
    const forgot = new Hono().post(
      "/",
      every(
        buildLimiter({ windowMs: 60_000, limit: 100, key: limitKeys.byAddress, message: "Network." }),
        buildLimiter({ windowMs: 60_000, limit: 2, key: limitKeys.byEmail, message: "Address." })
      ),
      async (c) => c.json({ email: (await c.req.json()).email })
    );

    const first = await forgot.request("/", from("1.1.1.1", { email: "Victim@Example.com " }));
    expect(await first.json()).toEqual({ email: "Victim@Example.com " });
    await forgot.request("/", from("2.2.2.2", { email: "victim@example.com" }));

    const third = await forgot.request("/", from("3.3.3.3", { email: "victim@example.com" }));
    expect(third.status).toBe(429);
    expect((await third.json()).error).toBe("Address.");

    expect((await forgot.request("/", from("3.3.3.3", { email: "someone-else@example.com" }))).status).toBe(200);
  });
});

describe("live-update connections", () => {
  it("refuses a connection beyond the per-person limit", async () => {
    const user = await createVerifiedUser(app, { email: "many-tabs@example.com" });
    const fakes = Array.from({ length: MAX_STREAMS_PER_USER }, () => ({}) as SSEStreamingApi);
    for (const s of fakes) subscribe(user.userId, s);

    try {
      const res = await authedRequest(app, "/notifications/stream", user.cookie);
      expect(res.status).toBe(429);
      expect((await res.json()).error).toMatch(/tabs/);
    } finally {
      for (const s of fakes) unsubscribe(user.userId, s);
    }
  });
});

describe("emails to the poster", () => {
  it("emails once when a picker asks, cancels and asks again, but notifies each time", async () => {
    const poster = await createVerifiedUser(app, { email: "quiet-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "eager-picker@example.com" });
    const created = await authedRequest(app, "/posts", poster.cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Rice",
        pickupLat: 13.63,
        pickupLng: 79.42,
        pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
        pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    });
    const postId = (await created.json()).post.id;
    const ask = () =>
      authedRequest(app, "/requests", picker.cookie, {
        method: "POST",
        body: JSON.stringify({ postId, pickerName: "Picker", etaMinutes: 10, lat: 13.63, lng: 79.42 }),
      });

    const first = (await (await ask()).json()).request;
    await authedRequest(app, `/requests/${first.id}/cancel`, picker.cookie, { method: "POST" });
    expect((await ask()).status).toBe(201);

    await new Promise((r) => setTimeout(r, 100));
    const received = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, poster.userId), eq(notifications.type, "request_received")));
    expect(received).toHaveLength(2);
    expect(vi.mocked(notifyPoster).mock.calls.filter(([, kind]) => kind === "request_received")).toHaveLength(1);
  });
});
