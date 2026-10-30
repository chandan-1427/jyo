import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, notifications } from "../src/db/schema.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

// Seeded directly rather than via a real request flow's fire-and-forget
// createNotification() call — that's a side effect of a different route
// and would make these tests race against an un-awaited insert.
async function seedNotification(userId: string, message: string, read = false, postId?: string) {
  const [row] = await db
    .insert(notifications)
    .values({ userId, message, read, postId })
    .returning({ id: notifications.id });
  return row.id;
}

async function seedPost(posterId: string) {
  const now = Date.now();
  const [row] = await db
    .insert(foodPosts)
    .values({
      posterId,
      title: "Leftover rice",
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(now),
      pickupWindowEnd: new Date(now + 2 * 60 * 60 * 1000),
    })
    .returning({ id: foodPosts.id });
  return row.id;
}

async function readByMessage(cookie: string) {
  const body = await (await authedRequest(app, "/notifications", cookie)).json();
  return Object.fromEntries(body.notifications.map((n: { message: string; read: boolean }) => [n.message, n.read]));
}

describe("GET /notifications", () => {
  it("returns only the current user's notifications, newest first", async () => {
    const user = await createVerifiedUser(app, { email: "notif-owner@example.com" });
    const other = await createVerifiedUser(app, { email: "notif-other@example.com" });

    await seedNotification(user.userId, "First");
    await seedNotification(user.userId, "Second");
    await seedNotification(other.userId, "Not yours");

    const res = await authedRequest(app, "/notifications", user.cookie);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.notifications).toHaveLength(2);
    expect(body.notifications.map((n: { message: string }) => n.message)).toEqual(["Second", "First"]);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await app.request("/notifications");
    expect(res.status).toBe(401);
  });
});

describe("POST /notifications/:id/read", () => {
  it("marks only that notification as read", async () => {
    const user = await createVerifiedUser(app, { email: "read-one-owner@example.com" });
    const opened = await seedNotification(user.userId, "Opened");
    await seedNotification(user.userId, "Still unread");

    const res = await authedRequest(app, `/notifications/${opened}/read`, user.cookie, { method: "POST" });
    expect(res.status).toBe(200);

    const body = await (await authedRequest(app, "/notifications", user.cookie)).json();
    const readByMessage = Object.fromEntries(
      body.notifications.map((n: { message: string; read: boolean }) => [n.message, n.read])
    );
    expect(readByMessage).toEqual({ Opened: true, "Still unread": false });
  });

  it("is a 404 for someone else's notification, and leaves it unread", async () => {
    const user = await createVerifiedUser(app, { email: "read-one-intruder@example.com" });
    const other = await createVerifiedUser(app, { email: "read-one-victim@example.com" });
    const theirs = await seedNotification(other.userId, "Not yours");

    const res = await authedRequest(app, `/notifications/${theirs}/read`, user.cookie, { method: "POST" });
    expect(res.status).toBe(404);

    const body = await (await authedRequest(app, "/notifications", other.cookie)).json();
    expect(body.notifications[0].read).toBe(false);
  });

  it("is a 404 for an id that isn't a UUID", async () => {
    const user = await createVerifiedUser(app, { email: "read-one-bad-id@example.com" });
    const res = await authedRequest(app, "/notifications/not-a-uuid/read", user.cookie, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("POST /notifications/post/:postId/read", () => {
  it("marks all of that post's notifications read, and only that post's", async () => {
    const user = await createVerifiedUser(app, { email: "read-post-owner@example.com" });
    const opened = await seedPost(user.userId);
    const other = await seedPost(user.userId);
    await seedNotification(user.userId, "Request came in", false, opened);
    await seedNotification(user.userId, "Request cancelled", false, opened);
    await seedNotification(user.userId, "About another post", false, other);

    const res = await authedRequest(app, `/notifications/post/${opened}/read`, user.cookie, { method: "POST" });
    expect(res.status).toBe(200);
    expect((await res.json()).marked).toBe(2);

    expect(await readByMessage(user.cookie)).toEqual({
      "Request came in": true,
      "Request cancelled": true,
      "About another post": false,
    });
  });

  it("leaves other users' notifications about the same post unread", async () => {
    const poster = await createVerifiedUser(app, { email: "read-post-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "read-post-picker@example.com" });
    const post = await seedPost(poster.userId);
    await seedNotification(picker.userId, "Your request was approved", false, post);

    const res = await authedRequest(app, `/notifications/post/${post}/read`, poster.cookie, { method: "POST" });
    expect(res.status).toBe(200);
    expect((await res.json()).marked).toBe(0);

    expect(await readByMessage(picker.cookie)).toEqual({ "Your request was approved": false });
  });

  it("is a 404 for a post id that isn't a UUID", async () => {
    const user = await createVerifiedUser(app, { email: "read-post-bad-id@example.com" });
    const res = await authedRequest(app, "/notifications/post/not-a-uuid/read", user.cookie, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("POST /notifications/read-all", () => {
  it("marks all of the current user's notifications as read, without touching other users'", async () => {
    const user = await createVerifiedUser(app, { email: "read-all-owner@example.com" });
    const other = await createVerifiedUser(app, { email: "read-all-other@example.com" });

    await seedNotification(user.userId, "Unread one");
    await seedNotification(user.userId, "Unread two");
    await seedNotification(other.userId, "Someone else's unread");

    const res = await authedRequest(app, "/notifications/read-all", user.cookie, { method: "POST" });
    expect(res.status).toBe(200);

    const mine = await authedRequest(app, "/notifications", user.cookie);
    const mineBody = await mine.json();
    expect(mineBody.notifications.every((n: { read: boolean }) => n.read)).toBe(true);

    const theirs = await authedRequest(app, "/notifications", other.cookie);
    const theirsBody = await theirs.json();
    expect(theirsBody.notifications.every((n: { read: boolean }) => n.read === false)).toBe(true);
  });
});
