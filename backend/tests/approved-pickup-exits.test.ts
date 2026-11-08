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
import { foodPosts, notifications, pickupRequests } from "../src/db/schema.js";
import { notifyPicker, notifyPoster } from "../src/lib/mailer.js";
import { runAutoComplete, AUTO_COMPLETE_AFTER_MS } from "../src/jobs/expiry.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";
import { backgroundSettled } from "../src/lib/background.js";

const app = createApp();
const HOUR = 60 * 60 * 1000;

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
      pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
      diet: "veg", servings: 2, cookedAt: new Date().toISOString(),
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).post as { id: string };
}

function askFor(cookie: string, postId: string) {
  return authedRequest(app, "/requests", cookie, {
    method: "POST",
    body: JSON.stringify({ postId, pickerName: "Picker", etaMinutes: 15, lat: 13.63, lng: 79.42 }),
  });
}

const post = (cookie: string, path: string) => authedRequest(app, path, cookie, { method: "POST" });

// A pickup the poster has approved: what both actions start from.
async function approvedPickup() {
  const poster = await createVerifiedUser(app);
  const picker = await createVerifiedUser(app);
  const { id: postId } = await newPost(poster.cookie);
  const asked = await askFor(picker.cookie, postId);
  expect(asked.status).toBe(201);
  const requestId = (await asked.json()).request.id as string;
  expect((await post(poster.cookie, `/requests/${requestId}/approve`)).status).toBe(200);
  vi.clearAllMocks();
  return { poster, picker, postId, requestId };
}

const reopen = (cookie: string, postId: string) => post(cookie, `/posts/${postId}/reopen`);
const withdraw = (cookie: string, requestId: string) => post(cookie, `/requests/${requestId}/cancel`);

const postRow = async (id: string) => (await db.select().from(foodPosts).where(eq(foodPosts.id, id)))[0];
const requestRow = async (id: string) => (await db.select().from(pickupRequests).where(eq(pickupRequests.id, id)))[0];

// Notifications are created without being awaited by the route.
async function notificationsOfType(userId: string, type: "pickup_withdrawn" | "pickup_reopened") {
  await backgroundSettled();
  return db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.type, type)));
}

async function viewAs(cookie: string, postId: string) {
  const res = await authedRequest(app, `/posts/${postId}`, cookie);
  expect(res.status).toBe(200);
  return res.json();
}

describe("the picker can't make it", () => {
  it("ends the pickup, puts the food back in the feed and tells the poster", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();

    const res = await withdraw(picker.cookie, requestId);
    expect(res.status).toBe(200);

    const p = await postRow(postId);
    expect(p.status).toBe("open");
    expect(p.approvedRequestId).toBeNull();
    expect((await requestRow(requestId)).status).toBe("withdrawn");

    expect(await notificationsOfType(poster.userId, "pickup_withdrawn")).toHaveLength(1);
    expect(vi.mocked(notifyPoster)).toHaveBeenCalledWith(poster.email, "pickup_withdrawn");
  });

  it("takes the pickup spot and the poster's name away from the picker at once", async () => {
    const { picker, postId, requestId } = await approvedPickup();
    expect((await viewAs(picker.cookie, postId)).post.pickupLat).not.toBeNull();

    await withdraw(picker.cookie, requestId);

    const after = await viewAs(picker.cookie, postId);
    expect(after.isApprovedPicker).toBe(false);
    expect(after.post.pickupLat).toBeNull();
    expect(after.post.pickupLng).toBeNull();
    expect(after.post.posterName).toBeNull();
  });

  it("answers a repeat with success and tells the poster once", async () => {
    const { poster, picker, requestId } = await approvedPickup();

    const [a, b] = await Promise.all([withdraw(picker.cookie, requestId), withdraw(picker.cookie, requestId)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const again = await withdraw(picker.cookie, requestId);
    expect(again.status).toBe(200);

    expect(await notificationsOfType(poster.userId, "pickup_withdrawn")).toHaveLength(1);
    expect(vi.mocked(notifyPoster)).toHaveBeenCalledTimes(1);
  });

  it("ends the post instead once its pickup time has passed, and sends no email", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();
    await db.update(foodPosts).set({ pickupWindowEnd: new Date(Date.now() - 60_000) }).where(eq(foodPosts.id, postId));

    expect((await withdraw(picker.cookie, requestId)).status).toBe(200);

    expect((await postRow(postId)).status).toBe("expired");
    expect(await notificationsOfType(poster.userId, "pickup_withdrawn")).toHaveLength(1);
    expect(vi.mocked(notifyPoster)).not.toHaveBeenCalled();
  });

  it("refuses once the food has been marked collected", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();
    await post(poster.cookie, `/posts/${postId}/complete`);

    const res = await withdraw(picker.cookie, requestId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("This food has already been marked as collected");
    expect((await requestRow(requestId)).status).toBe("approved");
  });

  it("lets the picker ask for it again later", async () => {
    const { picker, postId, requestId } = await approvedPickup();
    await withdraw(picker.cookie, requestId);

    expect((await askFor(picker.cookie, postId)).status).toBe(201);
  });

  it("can't be done by anyone but the picker", async () => {
    const { poster, postId, requestId } = await approvedPickup();
    const stranger = await createVerifiedUser(app);

    expect((await withdraw(poster.cookie, requestId)).status).toBe(403);
    expect((await withdraw(stranger.cookie, requestId)).status).toBe(403);
    expect((await postRow(postId)).status).toBe("closed");
  });
});

describe("the poster calls off a pickup the picker didn't come to", () => {
  it("puts the food back in the feed and tells the picker", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();

    const res = await reopen(poster.cookie, postId);
    expect(res.status).toBe(200);

    const p = await postRow(postId);
    expect(p.status).toBe("open");
    expect(p.approvedRequestId).toBeNull();
    expect((await requestRow(requestId)).status).toBe("missed");

    expect(await notificationsOfType(picker.userId, "pickup_reopened")).toHaveLength(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledWith(picker.email, "pickup_reopened");
  });

  it("takes the pickup spot away from the picker at once", async () => {
    const { poster, picker, postId } = await approvedPickup();
    await reopen(poster.cookie, postId);

    const after = await viewAs(picker.cookie, postId);
    expect(after.isApprovedPicker).toBe(false);
    expect(after.post.pickupLat).toBeNull();
    expect(after.post.posterName).toBeNull();
  });

  it("answers a repeat with success and tells the picker once", async () => {
    const { poster, picker, postId } = await approvedPickup();

    const [a, b] = await Promise.all([reopen(poster.cookie, postId), reopen(poster.cookie, postId)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await reopen(poster.cookie, postId)).status).toBe(200);

    expect(await notificationsOfType(picker.userId, "pickup_reopened")).toHaveLength(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledTimes(1);
  });

  it("ends the post instead once its pickup time has passed", async () => {
    const { poster, postId } = await approvedPickup();
    await db.update(foodPosts).set({ pickupWindowEnd: new Date(Date.now() - 60_000) }).where(eq(foodPosts.id, postId));

    expect((await reopen(poster.cookie, postId)).status).toBe(200);
    expect((await postRow(postId)).status).toBe("expired");
  });

  it("stops the missed picker asking for the same food again, but not anyone else", async () => {
    const { poster, picker, postId } = await approvedPickup();
    await reopen(poster.cookie, postId);

    const again = await askFor(picker.cookie, postId);
    expect(again.status).toBe(409);
    expect((await again.json()).error).toMatch(/marked your last pickup of this as missed/);

    const someoneElse = await createVerifiedUser(app);
    expect((await askFor(someoneElse.cookie, postId)).status).toBe(201);
  });

  it("refuses once the food has been marked collected", async () => {
    const { poster, postId, requestId } = await approvedPickup();
    await post(poster.cookie, `/posts/${postId}/complete`);

    expect((await reopen(poster.cookie, postId)).status).toBe(409);
    expect((await requestRow(requestId)).status).toBe("approved");
  });

  it("refuses when nobody was ever approved", async () => {
    const poster = await createVerifiedUser(app);
    const { id } = await newPost(poster.cookie);

    const res = await reopen(poster.cookie, id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("There's no approved pickup to call off");
  });

  it("can't be done by the picker or a stranger", async () => {
    const { picker, postId } = await approvedPickup();
    const stranger = await createVerifiedUser(app);

    expect((await reopen(picker.cookie, postId)).status).toBe(403);
    expect((await reopen(stranger.cookie, postId)).status).toBe(403);
    expect((await postRow(postId)).status).toBe("closed");
  });

  it("answers 404 for a malformed or unknown post", async () => {
    const poster = await createVerifiedUser(app);
    expect((await reopen(poster.cookie, "not-a-uuid")).status).toBe(404);
    expect((await reopen(poster.cookie, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });
});

describe("calling off, backing out and collecting at the same moment", () => {
  it("lets exactly one of them happen", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();

    const [r, w, c] = await Promise.all([
      reopen(poster.cookie, postId),
      withdraw(picker.cookie, requestId),
      post(poster.cookie, `/posts/${postId}/complete`),
    ]);
    const statuses = [r.status, w.status, c.status];
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);

    const p = await postRow(postId);
    const req = await requestRow(requestId);
    const reopened = (await notificationsOfType(picker.userId, "pickup_reopened")).length;
    const withdrawn = (await notificationsOfType(poster.userId, "pickup_withdrawn")).length;

    if (p.status === "completed") {
      expect(req.status).toBe("approved");
      expect(reopened + withdrawn).toBe(0);
    } else {
      expect(p.status).toBe("open");
      expect(p.approvedRequestId).toBeNull();
      expect(["missed", "withdrawn"]).toContain(req.status);
      expect(reopened + withdrawn).toBe(1);
      expect(req.status === "missed" ? reopened : withdrawn).toBe(1);
    }
  });
});

describe("what the poster sees while a pickup is on", () => {
  it("shows who's coming, when they were approved and their ETA, to the poster only", async () => {
    const { poster, picker, postId } = await approvedPickup();

    const asPoster = await viewAs(poster.cookie, postId);
    expect(asPoster.approvedPickup.pickerName).toBe("Picker");
    expect(asPoster.approvedPickup.etaMinutes).toBe(15);
    expect(new Date(asPoster.approvedPickup.approvedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);

    expect((await viewAs(picker.cookie, postId)).approvedPickup).toBeNull();
    const stranger = await createVerifiedUser(app);
    expect((await viewAs(stranger.cookie, postId)).approvedPickup).toBeNull();
  });
});

describe("approved pickups nobody marked collected", () => {
  it("are taken as collected two hours after the pickup window, not before", async () => {
    const { picker, postId } = await approvedPickup();
    const windowEnd = (await postRow(postId)).pickupWindowEnd.getTime();

    await runAutoComplete(new Date(windowEnd + AUTO_COMPLETE_AFTER_MS - 60_000));
    expect((await postRow(postId)).status).toBe("closed");

    await runAutoComplete(new Date(windowEnd + AUTO_COMPLETE_AFTER_MS + 60_000));
    const p = await postRow(postId);
    expect(p.status).toBe("completed");
    expect(p.autoCompleted).toBe(true);

    // The picker no longer has the pickup spot.
    expect((await viewAs(picker.cookie, postId)).post.pickupLat).toBeNull();
  });

  it("leave a pickup the poster marked collected as confirmed", async () => {
    const { poster, postId } = await approvedPickup();
    await post(poster.cookie, `/posts/${postId}/complete`);
    const windowEnd = (await postRow(postId)).pickupWindowEnd.getTime();

    await runAutoComplete(new Date(windowEnd + AUTO_COMPLETE_AFTER_MS + 60_000));
    expect((await postRow(postId)).autoCompleted).toBe(false);
  });
});

describe("My requests", () => {
  it("lists a missed pickup under declined and a withdrawn one under cancelled", async () => {
    const first = await approvedPickup();
    await reopen(first.poster.cookie, first.postId);

    const second = await approvedPickup();
    await withdraw(second.picker.cookie, second.requestId);

    const declined = await (await authedRequest(app, "/requests/mine?status=declined", first.picker.cookie)).json();
    expect(declined.requests.map((r: { id: string }) => r.id)).toEqual([first.requestId]);

    const cancelled = await (await authedRequest(app, "/requests/mine?status=cancelled", second.picker.cookie)).json();
    expect(cancelled.requests.map((r: { id: string }) => r.id)).toEqual([second.requestId]);
  });
});
