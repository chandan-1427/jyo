import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, notifications, pickupRequests } from "../src/db/schema.js";
import { and, eq } from "drizzle-orm";
import { notifyPicker, notifyPoster } from "../src/lib/mailer.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

async function createPost(cookie: string) {
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
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.post as { id: string };
}

async function createRequest(cookie: string, postId: string) {
  const res = await authedRequest(app, "/requests", cookie, {
    method: "POST",
    body: JSON.stringify({
      postId,
      pickerName: "Picker",
      etaMinutes: 15,
      lat: 13.63,
      lng: 79.42,
    }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.request as { id: string };
}

// Notifications are created without being awaited by the route.
async function notificationsOfType(userId: string, type: "request_approved" | "request_rejected" | "request_cancelled") {
  await new Promise((r) => setTimeout(r, 100));
  return db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.type, type)));
}

async function setUpPendingRequest() {
  const poster = await createVerifiedUser(app, { email: `poster-${Math.random()}@example.com` });
  const picker = await createVerifiedUser(app, { email: `picker-${Math.random()}@example.com` });
  const post = await createPost(poster.cookie);
  const request = await createRequest(picker.cookie, post.id);
  return { poster, picker, post, request };
}

describe("concurrent approve", () => {
  // A double tap: both answer "approved", and it happens (and the picker is
  // told) exactly once.
  it("approves once when two approve calls arrive together", async () => {
    const { poster, picker, request, post } = await setUpPendingRequest();

    const [a, b] = await Promise.all([
      authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" }),
      authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    expect(finalPost.status).toBe("closed");
    expect(finalPost.approvedRequestId).toBe(request.id);

    const [finalRequest] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, request.id));
    expect(finalRequest.status).toBe("approved");

    expect(await notificationsOfType(picker.userId, "request_approved")).toHaveLength(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledTimes(1);
  });

  // The first answer was lost on the way; asking again is not an error.
  it("answers a repeated approve with success, changing nothing", async () => {
    const { poster, picker, request } = await setUpPendingRequest();
    await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });

    const again = await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });
    expect(again.status).toBe(200);
    expect((await again.json()).message).toBe("Request approved");
    expect(await notificationsOfType(picker.userId, "request_approved")).toHaveLength(1);
  });

  it("still refuses to approve a request that was declined", async () => {
    const { poster, request } = await setUpPendingRequest();
    await authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "POST" });

    const res = await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });
    expect(res.status).toBe(409);
  });
});

describe("concurrent reject", () => {
  it("declines once when two reject calls arrive together", async () => {
    const { poster, picker, request, post } = await setUpPendingRequest();

    const [a, b] = await Promise.all([
      authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "POST" }),
      authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "POST" }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    expect(finalPost.status).toBe("open");

    const [finalRequest] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, request.id));
    expect(finalRequest.status).toBe("rejected");

    expect(await notificationsOfType(picker.userId, "request_rejected")).toHaveLength(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledTimes(1);
  });

  it("answers a repeated reject with success", async () => {
    const { poster, request } = await setUpPendingRequest();
    await authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "POST" });

    const again = await authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "POST" });
    expect(again.status).toBe(200);
  });
});

describe("concurrent cancel", () => {
  it("cancels once when two cancel calls arrive together", async () => {
    const { poster, picker, request, post } = await setUpPendingRequest();

    const [a, b] = await Promise.all([
      authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "POST" }),
      authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "POST" }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    expect(finalPost.status).toBe("open");

    const [finalRequest] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, request.id));
    expect(finalRequest.status).toBe("cancelled");

    expect(await notificationsOfType(poster.userId, "request_cancelled")).toHaveLength(1);
    expect(vi.mocked(notifyPoster).mock.calls.filter(([, kind]) => kind === "request_cancelled")).toHaveLength(1);
  });

  it("answers a repeated cancel with success", async () => {
    const { picker, request } = await setUpPendingRequest();
    await authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "POST" });

    const again = await authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "POST" });
    expect(again.status).toBe(200);
    expect((await again.json()).message).toBe("Request cancelled");
  });

  it("cannot cancel a request that's already been approved", async () => {
    const { poster, picker, request } = await setUpPendingRequest();

    const approveRes = await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });
    expect(approveRes.status).toBe(200);

    const cancelRes = await authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "POST" });
    expect(cancelRes.status).toBe(409);
    expect((await cancelRes.json()).error).toBe("This request has already been approved");
  });

  // It used to always say "already been approved", whatever had happened.
  it("says what happened to a request that was declined", async () => {
    const { poster, picker, request } = await setUpPendingRequest();
    await authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "POST" });

    const cancelRes = await authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "POST" });
    expect(cancelRes.status).toBe(409);
    expect((await cancelRes.json()).error).toBe("This request was already declined");
  });
});

describe("concurrent complete", () => {
  it("completes once when two complete calls arrive together", async () => {
    const { poster, request, post } = await setUpPendingRequest();

    const approveRes = await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });
    expect(approveRes.status).toBe(200);

    const [a, b] = await Promise.all([
      authedRequest(app, `/posts/${post.id}/complete`, poster.cookie, { method: "POST" }),
      authedRequest(app, `/posts/${post.id}/complete`, poster.cookie, { method: "POST" }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    expect(finalPost.status).toBe("completed");

    const again = await authedRequest(app, `/posts/${post.id}/complete`, poster.cookie, { method: "POST" });
    expect(again.status).toBe(200);
  });
});

describe("invalid IDs", () => {
  it("returns 404, not a 500, for a malformed request ID", async () => {
    const { poster } = await setUpPendingRequest();
    const res = await authedRequest(app, "/requests/not-a-uuid/approve", poster.cookie, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns 404, not a 500, for a malformed post ID", async () => {
    const { poster } = await setUpPendingRequest();
    const res = await authedRequest(app, "/posts/not-a-uuid", poster.cookie);
    expect(res.status).toBe(404);
  });
});

describe("delete racing a new request", () => {
  // Before the delete locked the post, a request could claim it between the
  // delete's status check and its writes, and the delete then wiped out the
  // new pending request along with the post. Now exactly one side wins and
  // nothing is left half-done. Repeated, since the interleaving varies.
  it("either deletes the post or keeps it with the request, never a mix", async () => {
    for (let i = 0; i < 5; i++) {
      const poster = await createVerifiedUser(app, { email: `race-poster-${i}-${Math.random()}@example.com` });
      const picker = await createVerifiedUser(app, { email: `race-picker-${i}-${Math.random()}@example.com` });
      const post = await createPost(poster.cookie);

      const [deleteRes, requestRes] = await Promise.all([
        authedRequest(app, `/posts/${post.id}`, poster.cookie, { method: "DELETE" }),
        authedRequest(app, "/requests", picker.cookie, {
          method: "POST",
          body: JSON.stringify({ postId: post.id, pickerName: "Picker", etaMinutes: 15, lat: 13.63, lng: 79.42 }),
        }),
      ]);

      const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
      const requests = await db.select().from(pickupRequests).where(eq(pickupRequests.postId, post.id));

      if (deleteRes.status === 200) {
        // 409 if it read the post before it was gone, 404 if after.
        expect([409, 404]).toContain(requestRes.status);
        expect(finalPost).toBeUndefined();
        expect(requests).toHaveLength(0);
      } else {
        expect(deleteRes.status).toBe(409);
        expect(requestRes.status).toBe(201);
        expect(finalPost.status).toBe("pending_approval");
        expect(requests).toHaveLength(1);
      }
    }
  });
});
