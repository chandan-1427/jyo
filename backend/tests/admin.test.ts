import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
  sendReportEmail: vi.fn(),
}));

import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { pushSubscriptions, reports, users } from "../src/db/schema.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";
import { backgroundSettled } from "../src/lib/background.js";

const app = createApp();
const ADMIN = "admin@example.com";

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const get = (cookie: string, path: string) => authedRequest(app, path, cookie);
const post = (cookie: string, path: string, body?: unknown) =>
  authedRequest(app, path, cookie, { method: "POST", body: JSON.stringify(body ?? {}) });

async function share(cookie: string, title = "Veg pulao") {
  const res = await post(cookie, "/posts", {
    title,
    pickupLat: 13.63,
    pickupLng: 79.42,
    pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
    pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    diet: "veg",
    servings: 2,
    cookedAt: new Date().toISOString(),
  });
  return (await res.json()).post.id as string;
}

const feedTitles = async (cookie: string) =>
  ((await (await get(cookie, "/posts?lat=13.63&lng=79.42")).json()).posts as { title: string }[]).map((p) => p.title);

const login = (email: string) =>
  app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });

describe("who is an admin", () => {
  it("is the verified account whose email is in ADMIN_EMAILS, and nobody else", async () => {
    const admin = await createVerifiedUser(app, { email: ADMIN });
    const other = await createVerifiedUser(app);

    expect((await (await get(admin.cookie, "/users/me")).json()).user.isAdmin).toBe(true);
    expect((await (await get(other.cookie, "/users/me")).json()).user.isAdmin).toBe(false);
    expect((await get(admin.cookie, "/admin/overview")).status).toBe(200);
  });

  it("finds the admin API missing for everyone else, logged in or not", async () => {
    const other = await createVerifiedUser(app);
    for (const path of ["/admin/overview", "/admin/reports", "/admin/users"]) {
      expect((await get(other.cookie, path)).status).toBe(404);
    }
    expect((await post(other.cookie, "/admin/posts/00000000-0000-4000-8000-000000000000/remove")).status).toBe(404);
    expect((await app.request("/admin/overview")).status).toBe(401);
  });
});

describe("reports", () => {
  it("lists open reports with both people's details, and resolving moves them to resolved", async () => {
    const admin = await createVerifiedUser(app, { email: ADMIN });
    const poster = await createVerifiedUser(app, { name: "Ravi Poster" });
    const viewer = await createVerifiedUser(app, { name: "Lakshmi Viewer" });
    const postId = await share(poster.cookie);
    await post(viewer.cookie, `/posts/${postId}/report`, { reason: "unsafe_food", details: "Smelled off" });

    const open = (await (await get(admin.cookie, "/admin/reports")).json()).reports;
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      reason: "unsafe_food",
      details: "Smelled off",
      postTitle: "Veg pulao",
      reporter: { name: "Lakshmi Viewer", email: viewer.email },
      reported: { name: "Ravi Poster", email: poster.email, suspendedAt: null },
      reportsAgainst: 1,
    });

    expect((await post(admin.cookie, `/admin/reports/${open[0].id}/resolve`)).status).toBe(200);
    expect((await (await get(admin.cookie, "/admin/reports")).json()).reports).toHaveLength(0);
    expect((await (await get(admin.cookie, "/admin/reports?status=resolved")).json()).reports).toHaveLength(1);
    expect((await db.select().from(reports))[0].resolvedAt).not.toBeNull();
  });
});

describe("suspending", () => {
  it("ends their sessions, refuses their login, hides their posts and stops their notifications", async () => {
    const admin = await createVerifiedUser(app, { email: ADMIN });
    const bad = await createVerifiedUser(app);
    const viewer = await createVerifiedUser(app);
    const badPost = await share(bad.cookie, "Bad post");
    await db.insert(pushSubscriptions).values({ userId: bad.userId, endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: "p", auth: "a" });

    const res = await post(admin.cookie, `/admin/users/${bad.userId}/suspend`, { reason: "Selling food" });
    expect(res.status).toBe(200);

    const session = await get(bad.cookie, "/users/me");
    expect(session.status).toBe(403);
    expect((await session.json()).error).toMatch(/suspended/);
    expect((await login(bad.email)).status).toBe(403);
    expect(await feedTitles(viewer.cookie)).not.toContain("Bad post");
    expect((await get(viewer.cookie, `/posts/${badPost}`)).status).toBe(404);
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, bad.userId))).toHaveLength(0);
    const [row] = await db.select().from(users).where(eq(users.id, bad.userId));
    expect(row.suspendedReason).toBe("Selling food");
  });

  it("reveals nothing to someone guessing a suspended account's password", async () => {
    const admin = await createVerifiedUser(app, { email: ADMIN });
    const bad = await createVerifiedUser(app);
    await post(admin.cookie, `/admin/users/${bad.userId}/suspend`, { reason: "Harassment" });

    const wrong = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: bad.email, password: "not-the-password" }),
    });
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error).toBe("Invalid email or password");
  });

  it("can be undone, after which they log in and their posts show again", async () => {
    const admin = await createVerifiedUser(app, { email: ADMIN });
    const person = await createVerifiedUser(app);
    const viewer = await createVerifiedUser(app);
    await share(person.cookie, "Curd rice");
    await post(admin.cookie, `/admin/users/${person.userId}/suspend`, { reason: "Mistake" });

    expect((await post(admin.cookie, `/admin/users/${person.userId}/unsuspend`)).status).toBe(200);
    expect((await login(person.email)).status).toBe(200);
    expect(await feedTitles(viewer.cookie)).toContain("Curd rice");
  });

  it("can't be used on an admin, and asks for a reason", async () => {
    const admin = await createVerifiedUser(app, { email: ADMIN });
    const person = await createVerifiedUser(app);
    expect((await post(admin.cookie, `/admin/users/${admin.userId}/suspend`, { reason: "Testing" })).status).toBe(403);
    expect((await post(admin.cookie, `/admin/users/${person.userId}/suspend`, {})).status).toBe(400);
  });
});

describe("removing a post", () => {
  it("hides it from the feed and its page, for everyone including the poster", async () => {
    const admin = await createVerifiedUser(app, { email: ADMIN });
    const poster = await createVerifiedUser(app);
    const viewer = await createVerifiedUser(app);
    const postId = await share(poster.cookie, "Spam");

    expect((await post(admin.cookie, `/admin/posts/${postId}/remove`)).status).toBe(200);
    await backgroundSettled();

    expect(await feedTitles(viewer.cookie)).not.toContain("Spam");
    expect((await get(viewer.cookie, `/posts/${postId}`)).status).toBe(404);
    expect((await get(poster.cookie, `/posts/${postId}`)).status).toBe(404);
  });
});

describe("people and overview", () => {
  it("finds people by name or email, with their activity and reports against them", async () => {
    const admin = await createVerifiedUser(app, { email: ADMIN });
    const ravi = await createVerifiedUser(app, { name: "Ravi Kumar" });
    await createVerifiedUser(app, { name: "Someone Else" });
    await share(ravi.cookie);

    const found = (await (await get(admin.cookie, "/admin/users?search=ravi")).json()).users;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "Ravi Kumar", email: ravi.email, posts: 1, requests: 0, reportsAgainst: 0, isAdmin: false });

    const overview = await (await get(admin.cookie, "/admin/overview")).json();
    expect(overview).toMatchObject({ people: 3, activePosts: 1, openReports: 0, suspended: 0 });
  });
});
