import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { and, eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, notifications, pickupRequests, users } from "../src/db/schema.js";
import { notifyPicker } from "../src/lib/mailer.js";
import { runExpiry } from "../src/jobs/expiry.js";
import { runUnverifiedUserCleanup } from "../src/jobs/unverifiedUserCleanup.js";
import { runNotificationCleanup, RETENTION_DAYS } from "../src/jobs/notificationCleanup.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const later = (ms: number) => new Date(Date.now() + ms);

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

// A post whose pickup window ends in an hour.
async function newPost(cookie: string) {
  const res = await authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Rice and dal for 2",
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
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

const postStatus = async (id: string) =>
  (await db.select({ s: foodPosts.status }).from(foodPosts).where(eq(foodPosts.id, id)))[0].s;
const requestStatus = async (id: string) =>
  (await db.select({ s: pickupRequests.status }).from(pickupRequests).where(eq(pickupRequests.id, id)))[0].s;

// Notifications are created without being awaited.
async function notificationsFor(userId: string, type: "request_rejected") {
  await new Promise((r) => setTimeout(r, 100));
  return db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.type, type)));
}

describe("expiring posts", () => {
  it("ends an open post once its pickup window has passed, not before", async () => {
    const poster = await createVerifiedUser(app, { email: "expiry-open@example.com" });
    const post = await newPost(poster.cookie);

    await runExpiry(later(30 * 60 * 1000));
    expect(await postStatus(post.id)).toBe("open");

    await runExpiry(later(2 * HOUR));
    expect(await postStatus(post.id)).toBe("expired");
  });

  it("declines the request left waiting and tells the picker, once", async () => {
    const poster = await createVerifiedUser(app, { email: "expiry-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "expiry-picker@example.com" });
    const post = await newPost(poster.cookie);
    const request = await askFor(picker.cookie, post.id);

    const result = await runExpiry(later(2 * HOUR));

    expect(await postStatus(post.id)).toBe("expired");
    expect(await requestStatus(request.id)).toBe("rejected");
    expect(result.declined.map((r) => r.id)).toEqual([request.id]);
    expect(await notificationsFor(picker.userId, "request_rejected")).toHaveLength(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledWith(picker.email, "request_rejected");

    // Running again finds nothing left to do.
    const again = await runExpiry(later(3 * HOUR));
    expect(again.expired).toHaveLength(0);
    expect(await notificationsFor(picker.userId, "request_rejected")).toHaveLength(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledTimes(1);
  });

  it("leaves an approved pickup alone after its window, for the poster to mark collected", async () => {
    const poster = await createVerifiedUser(app, { email: "expiry-approved@example.com" });
    const picker = await createVerifiedUser(app, { email: "expiry-approved-picker@example.com" });
    const post = await newPost(poster.cookie);
    const request = await askFor(picker.cookie, post.id);
    await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });

    await runExpiry(later(2 * HOUR));

    expect(await postStatus(post.id)).toBe("closed");
    expect(await requestStatus(request.id)).toBe("approved");
  });

  it("leaves a collected post and earlier answered requests as they were", async () => {
    const poster = await createVerifiedUser(app, { email: "expiry-done@example.com" });
    const picker = await createVerifiedUser(app, { email: "expiry-done-picker@example.com" });
    const other = await createVerifiedUser(app, { email: "expiry-done-other@example.com" });

    const collected = await newPost(poster.cookie);
    const approved = await askFor(picker.cookie, collected.id);
    await authedRequest(app, `/requests/${approved.id}/approve`, poster.cookie, { method: "POST" });
    await authedRequest(app, `/posts/${collected.id}/complete`, poster.cookie, { method: "POST" });

    const reopened = await newPost(poster.cookie);
    const declinedEarlier = await askFor(other.cookie, reopened.id);
    await authedRequest(app, `/requests/${declinedEarlier.id}/reject`, poster.cookie, { method: "POST" });
    const cancelledEarlier = await askFor(picker.cookie, reopened.id);
    await authedRequest(app, `/requests/${cancelledEarlier.id}/cancel`, picker.cookie, { method: "POST" });
    vi.clearAllMocks();

    await runExpiry(later(2 * HOUR));

    expect(await postStatus(collected.id)).toBe("completed");
    expect(await postStatus(reopened.id)).toBe("expired");
    expect(await requestStatus(declinedEarlier.id)).toBe("rejected");
    expect(await requestStatus(cancelledEarlier.id)).toBe("cancelled");
    expect(vi.mocked(notifyPicker)).not.toHaveBeenCalled();
  });
});

describe("removing unverified sign-ups", () => {
  async function account(email: string, fields: { emailVerified: boolean; verificationTokenExpiry: Date | null }) {
    const [row] = await db
      .insert(users)
      .values({ name: "Someone", email, passwordHash: "x", phone: "9876543210", ...fields })
      .returning({ id: users.id });
    return row.id;
  }
  const exists = async (id: string) => (await db.select().from(users).where(eq(users.id, id))).length === 1;

  it("deletes only accounts never verified whose link has expired", async () => {
    const expired = await account("never-verified@example.com", { emailVerified: false, verificationTokenExpiry: later(-HOUR) });
    const stillValid = await account("still-pending@example.com", { emailVerified: false, verificationTokenExpiry: later(HOUR) });
    const noExpiry = await account("no-expiry@example.com", { emailVerified: false, verificationTokenExpiry: null });
    // A verified account keeps its used token and its old expiry.
    const verifiedOldToken = await account("verified-old-token@example.com", { emailVerified: true, verificationTokenExpiry: later(-30 * DAY) });
    const verified = await account("verified@example.com", { emailVerified: true, verificationTokenExpiry: null });

    const deleted = await runUnverifiedUserCleanup();

    expect(deleted.map((d) => d.id)).toEqual([expired]);
    expect(await exists(expired)).toBe(false);
    for (const kept of [stillValid, noExpiry, verifiedOldToken, verified]) expect(await exists(kept)).toBe(true);
  });

  it("never deletes someone who signed up and verified through the app", async () => {
    const user = await createVerifiedUser(app, { email: "real-user@example.com" });
    await runUnverifiedUserCleanup(later(365 * DAY));
    expect(await exists(user.userId)).toBe(true);
  });
});

describe("removing old notifications", () => {
  it(`deletes notifications older than ${RETENTION_DAYS} days, read or not, and keeps newer ones`, async () => {
    const user = await createVerifiedUser(app, { email: "notified@example.com" });
    const insert = (daysAgo: number, read: boolean) =>
      db
        .insert(notifications)
        .values({ userId: user.userId, message: "m", read, createdAt: later(-daysAgo * DAY) })
        .returning({ id: notifications.id })
        .then(([r]) => r.id);

    const oldUnread = await insert(RETENTION_DAYS + 1, false);
    const oldRead = await insert(RETENTION_DAYS + 1, true);
    const recent = await insert(RETENTION_DAYS - 1, false);

    const deleted = (await runNotificationCleanup()).map((d) => d.id).sort();

    expect(deleted).toEqual([oldUnread, oldRead].sort());
    const left = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.userId, user.userId));
    expect(left.map((n) => n.id)).toEqual([recent]);
  });
});
