import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { eq } from "drizzle-orm";
import { createApp, allowedOriginsFor } from "../src/app.js";
import { db } from "../src/db/index.js";
import { pickupRequests } from "../src/db/schema.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

async function newPost(cookie: string) {
  const res = await authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Rice and dal for 2",
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  });
  return (await res.json()).post as { id: string };
}

async function askFor(cookie: string, postId: string) {
  const res = await authedRequest(app, "/requests", cookie, {
    method: "POST",
    body: JSON.stringify({ postId, pickerName: "Picker", etaMinutes: 15, lat: 13.63, lng: 79.42 }),
  });
  return (await res.json()).request as { id: string };
}

async function requestStatus(id: string) {
  const [row] = await db.select({ status: pickupRequests.status }).from(pickupRequests).where(eq(pickupRequests.id, id));
  return row.status;
}

// One user acting on another's things by id: the API must refuse it whatever
// the id, and change nothing.
describe("acting on someone else's things", () => {
  it("won't let anyone but the poster approve or decline a request", async () => {
    const poster = await createVerifiedUser(app, { email: "owner@example.com" });
    const picker = await createVerifiedUser(app, { email: "picker@example.com" });
    const stranger = await createVerifiedUser(app, { email: "stranger@example.com" });
    const request = await askFor(picker.cookie, (await newPost(poster.cookie)).id);

    for (const action of ["approve", "reject"]) {
      for (const who of [stranger, picker]) {
        const res = await authedRequest(app, `/requests/${request.id}/${action}`, who.cookie, { method: "POST" });
        expect(res.status, `${action} by ${who.email}`).toBe(403);
      }
    }
    expect(await requestStatus(request.id)).toBe("pending");
  });

  it("won't let anyone but the picker cancel a request", async () => {
    const poster = await createVerifiedUser(app, { email: "owner2@example.com" });
    const picker = await createVerifiedUser(app, { email: "picker2@example.com" });
    const stranger = await createVerifiedUser(app, { email: "stranger2@example.com" });
    const request = await askFor(picker.cookie, (await newPost(poster.cookie)).id);

    for (const who of [stranger, poster]) {
      const res = await authedRequest(app, `/requests/${request.id}/cancel`, who.cookie, { method: "POST" });
      expect(res.status, `cancel by ${who.email}`).toBe(403);
    }
    expect(await requestStatus(request.id)).toBe("pending");
  });

  it("hides a demo post seeded for one visitor from everyone else", async () => {
    const visitor = await createVerifiedUser(app, { email: "demo-visitor@example.com" });
    const other = await createVerifiedUser(app, { email: "other-visitor@example.com" });
    await authedRequest(app, "/auth/demo/start", visitor.cookie, { method: "POST" });

    const feed = await (await authedRequest(app, "/posts?lat=13.63&lng=79.42", visitor.cookie)).json();
    const seeded = feed.posts.find((p: { isDemo: boolean }) => p.isDemo);
    expect(seeded).toBeDefined();

    expect((await authedRequest(app, `/posts/${seeded.id}`, visitor.cookie)).status).toBe(200);
    expect((await authedRequest(app, `/posts/${seeded.id}`, other.cookie)).status).toBe(404);
  });
});

describe("what responses leave out", () => {
  it("sends no account ids or form keys in the feed or on a post's page", async () => {
    const poster = await createVerifiedUser(app, { email: "private-poster@example.com" });
    const viewer = await createVerifiedUser(app, { email: "viewer@example.com" });
    const post = await newPost(poster.cookie);

    const feed = await (await authedRequest(app, "/posts?lat=13.63&lng=79.42", viewer.cookie)).json();
    const page = await (await authedRequest(app, `/posts/${post.id}`, viewer.cookie)).json();

    for (const shown of [feed.posts[0], page.post]) {
      for (const key of ["posterId", "clientKey", "seededForUserId", "approvedRequestId", "demoExpiresAt"]) {
        expect(shown, key).not.toHaveProperty(key);
      }
    }
    expect(JSON.stringify(feed)).not.toContain(poster.userId);
    expect(JSON.stringify(page)).not.toContain(poster.userId);
  });

  it("shows the poster a waiting request without the picker's account id", async () => {
    const poster = await createVerifiedUser(app, { email: "poster-view@example.com" });
    const picker = await createVerifiedUser(app, { email: "picker-view@example.com" });
    const post = await newPost(poster.cookie);
    await askFor(picker.cookie, post.id);

    const page = await (await authedRequest(app, `/posts/${post.id}`, poster.cookie)).json();
    expect(page.pendingRequest).toMatchObject({ pickerName: "Picker", etaMinutes: 15 });
    expect(JSON.stringify(page)).not.toContain(picker.userId);
  });
});

describe("browser protections", () => {
  it("sends security headers on every response, errors included", async () => {
    for (const res of [await app.request("/"), await app.request("/no-such-route")]) {
      expect(res.headers.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect(res.headers.get("cross-origin-resource-policy")).toBe("same-site");
    }
  });

  it("lets the app's own site call the API with cookies", async () => {
    const res = await app.request("/auth/login", {
      method: "OPTIONS",
      headers: { Origin: "https://www.jyo.co.in", "Access-Control-Request-Method": "POST" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://www.jyo.co.in");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("allows the local dev server only outside production", () => {
    expect(allowedOriginsFor("production")).not.toContain("http://localhost:5173");
    expect(allowedOriginsFor("production")).toEqual(["https://jyo.co.in", "https://www.jyo.co.in"]);
    expect(allowedOriginsFor("development")).toContain("http://localhost:5173");
  });
});
