import { describe, it, expect, vi, beforeEach } from "vitest";

// The app as it runs live. Some rules apply only there (the service area,
// the 20 km limit, the secure cookie), so the rest of the suite, which runs
// in the test environment, never reaches them.
vi.mock("../src/env.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/env.js")>();
  return { ...original, env: { ...original.env, APP_ENV: "production" } };
});

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

const TIRUPATI = { lat: 13.6288, lng: 79.4192 };
const NEAR_TIRUPATI = { lat: 13.65, lng: 79.42 };
const CHENNAI = { lat: 13.0827, lng: 80.2707 };

beforeEach(async () => {
  await resetDb();
});

function postAt(cookie: string, where: { lat: number; lng: number }) {
  return authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Rice and dal for 2",
      pickupLat: where.lat,
      pickupLng: where.lng,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  });
}

function askFrom(cookie: string, postId: string, where: { lat: number; lng: number }) {
  return authedRequest(app, "/requests", cookie, {
    method: "POST",
    body: JSON.stringify({ postId, pickerName: "Picker", etaMinutes: 15, lat: where.lat, lng: where.lng }),
  });
}

describe("the service area", () => {
  it("takes posts in Tirupati and refuses ones outside it", async () => {
    const poster = await createVerifiedUser(app, { email: "area-poster@example.com" });

    expect((await postAt(poster.cookie, TIRUPATI)).status).toBe(201);

    const outside = await postAt(poster.cookie, CHENNAI);
    expect(outside.status).toBe(403);
    expect((await outside.json()).error).toMatch(/only available in Tirupati/);
  });

  it("lets a demo visitor post from anywhere", async () => {
    const visitor = await createVerifiedUser(app, { email: "area-demo@example.com" });
    await authedRequest(app, "/auth/demo/start", visitor.cookie, { method: "POST" });
    expect((await postAt(visitor.cookie, CHENNAI)).status).toBe(201);
    // A demo post seeds a request in the background; let it finish before
    // the next test empties the database under it.
    await new Promise((r) => setTimeout(r, 300));
  });
});

describe("the 20 km limit on requests", () => {
  it("lets someone nearby ask, and refuses someone too far away", async () => {
    const poster = await createVerifiedUser(app, { email: "far-poster@example.com" });
    const near = await createVerifiedUser(app, { email: "near-picker@example.com" });
    const far = await createVerifiedUser(app, { email: "far-picker@example.com" });
    const post = (await (await postAt(poster.cookie, TIRUPATI)).json()).post;

    const tooFar = await askFrom(far.cookie, post.id, CHENNAI);
    expect(tooFar.status).toBe(403);
    expect((await tooFar.json()).error).toMatch(/too far/);

    expect((await askFrom(near.cookie, post.id, NEAR_TIRUPATI)).status).toBe(201);
  });
});

describe("the session cookie", () => {
  it("is Secure, HttpOnly and SameSite=Lax", async () => {
    await createVerifiedUser(app, { email: "cookie@example.com" });
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "cookie@example.com", password: "password123" }),
    });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
  });
});
