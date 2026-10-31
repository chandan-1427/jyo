import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { SignJWT } from "jose";
import { and, eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, users } from "../src/db/schema.js";
import { sendPasswordResetEmail } from "../src/lib/mailer.js";
import { SESSION_SECRET } from "../src/lib/session.js";
import { runDemoCleanup } from "../src/jobs/demoCleanup.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();
const TIRUPATI = { lat: 13.6288, lng: 79.4192 };
const HOUR = 3_600_000;

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

function postJson(path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });
}

async function createPost(cookie: string, title: string) {
  const res = await authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title,
      pickupLat: TIRUPATI.lat,
      pickupLng: TIRUPATI.lng,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).post as { id: string; isDemo: boolean };
}

const seededPostCount = async (userId: string) =>
  (await db.select().from(foodPosts).where(and(eq(foodPosts.seededForUserId, userId), eq(foodPosts.isDemo, true))))
    .length;

describe("demo mode comes from the account, not the session token", () => {
  // Regression: isDemo was a claim in the 7-day token. A demo that ended
  // with the tab closed (so the app never called /demo/stop) left the token
  // saying "demo" after the cleanup job had reset the account: the server
  // kept seeding sample posts, and saved the user's real posts as demo
  // posts nobody else could see.
  it("treats a demo that ended with the tab closed as over", async () => {
    const user = await createVerifiedUser(app, { email: "closed-tab@example.com" });
    await authedRequest(app, "/auth/demo/start", user.cookie, { method: "POST" });

    // Time runs out and the cleanup job resets the account; the same
    // cookie comes back later.
    await db.update(users).set({ demoExpiresAt: new Date(Date.now() - 1000) }).where(eq(users.id, user.userId));
    await runDemoCleanup();

    const post = await createPost(user.cookie, "Real food");
    expect(post.isDemo).toBe(false);

    await authedRequest(app, `/posts?lat=${TIRUPATI.lat}&lng=${TIRUPATI.lng}`, user.cookie);
    expect(await seededPostCount(user.userId)).toBe(0);
  });

  it("treats an expired demo as over even before the cleanup job runs", async () => {
    const user = await createVerifiedUser(app, { email: "expired-demo@example.com" });
    await authedRequest(app, "/auth/demo/start", user.cookie, { method: "POST" });
    await db.update(users).set({ demoExpiresAt: new Date(Date.now() - 1000) }).where(eq(users.id, user.userId));

    const post = await createPost(user.cookie, "Real food");
    expect(post.isDemo).toBe(false);
  });

  it("applies starting and ending a demo to every device at once, without a new cookie", async () => {
    const user = await createVerifiedUser(app, { email: "two-devices@example.com" });
    const login = await postJson("/auth/login", { email: user.email, password: "password123" });
    const otherDevice = login.headers.get("set-cookie")!.split(";")[0];

    const start = await authedRequest(app, "/auth/demo/start", user.cookie, { method: "POST" });
    expect(start.headers.get("set-cookie")).toBeNull();
    expect((await createPost(otherDevice, "From the other device")).isDemo).toBe(true);

    await authedRequest(app, "/auth/demo/stop", user.cookie, { method: "POST" });
    expect((await createPost(otherDevice, "After stopping")).isDemo).toBe(false);
  });

  // Sessions signed before this change carry isDemo (and email) but no
  // version: still accepted, with demo mode read from the account.
  it("accepts a session signed before versions existed, ignoring its isDemo claim", async () => {
    const user = await createVerifiedUser(app, { email: "old-token@example.com" });
    const oldToken = await new SignJWT({ userId: user.userId, email: user.email, isDemo: true })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(SESSION_SECRET);

    const post = await createPost(`token=${oldToken}`, "Old session");
    expect(post.isDemo).toBe(false);
  });
});

describe("sessions that should no longer work", () => {
  it("ends every other session when the password is reset", async () => {
    const user = await createVerifiedUser(app, { email: "reset-everywhere@example.com" });
    expect((await authedRequest(app, "/users/me", user.cookie)).status).toBe(200);

    await postJson("/auth/forgot-password", { email: user.email });
    const [, resetToken] = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)!;
    const reset = await postJson("/auth/reset-password", { token: resetToken, password: "a-new-password" });
    expect(reset.status).toBe(200);

    const stale = await authedRequest(app, "/users/me", user.cookie);
    expect(stale.status).toBe(401);
    expect(stale.headers.get("set-cookie")).toMatch(/^token=;/);

    const login = await postJson("/auth/login", { email: user.email, password: "a-new-password" });
    expect(login.status).toBe(200);
    const fresh = login.headers.get("set-cookie")!.split(";")[0];
    expect((await authedRequest(app, "/users/me", fresh)).status).toBe(200);
  });

  it("ends a session whose account no longer exists", async () => {
    const user = await createVerifiedUser(app, { email: "deleted-account@example.com" });
    await db.delete(users).where(eq(users.id, user.userId));

    const res = await authedRequest(app, "/users/me", user.cookie);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(/^token=;/);
  });

  it("refuses a validly signed token without a proper user id", async () => {
    const token = await new SignJWT({ userId: "not-a-uuid", ver: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(SESSION_SECRET);

    expect((await authedRequest(app, "/users/me", `token=${token}`)).status).toBe(401);
  });
});
