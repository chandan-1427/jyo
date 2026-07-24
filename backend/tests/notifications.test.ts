import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { notifications } from "../src/db/schema.js";
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
async function seedNotification(userId: string, message: string, read = false) {
  await db.insert(notifications).values({ userId, message, read });
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

describe("PUT /notifications/read-all", () => {
  it("marks all of the current user's notifications as read, without touching other users'", async () => {
    const user = await createVerifiedUser(app, { email: "read-all-owner@example.com" });
    const other = await createVerifiedUser(app, { email: "read-all-other@example.com" });

    await seedNotification(user.userId, "Unread one");
    await seedNotification(user.userId, "Unread two");
    await seedNotification(other.userId, "Someone else's unread");

    const res = await authedRequest(app, "/notifications/read-all", user.cookie, { method: "PUT" });
    expect(res.status).toBe(200);

    const mine = await authedRequest(app, "/notifications", user.cookie);
    const mineBody = await mine.json();
    expect(mineBody.notifications.every((n: { read: boolean }) => n.read)).toBe(true);

    const theirs = await authedRequest(app, "/notifications", other.cookie);
    const theirsBody = await theirs.json();
    expect(theirsBody.notifications.every((n: { read: boolean }) => n.read === false)).toBe(true);
  });
});
