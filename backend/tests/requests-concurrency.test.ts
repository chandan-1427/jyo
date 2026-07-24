import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, pickupRequests } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
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

async function setUpPendingRequest() {
  const poster = await createVerifiedUser(app, { email: `poster-${Math.random()}@example.com` });
  const picker = await createVerifiedUser(app, { email: `picker-${Math.random()}@example.com` });
  const post = await createPost(poster.cookie);
  const request = await createRequest(picker.cookie, post.id);
  return { poster, picker, post, request };
}

describe("concurrent approve", () => {
  it("only one of two simultaneous approve calls succeeds", async () => {
    const { poster, request, post } = await setUpPendingRequest();

    const [a, b] = await Promise.all([
      authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "PUT" }),
      authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "PUT" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);

    const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    expect(finalPost.status).toBe("closed");
    expect(finalPost.approvedRequestId).toBe(request.id);

    const [finalRequest] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, request.id));
    expect(finalRequest.status).toBe("approved");
  });
});

describe("concurrent reject", () => {
  it("only one of two simultaneous reject calls succeeds", async () => {
    const { poster, request, post } = await setUpPendingRequest();

    const [a, b] = await Promise.all([
      authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "PUT" }),
      authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "PUT" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);

    const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    expect(finalPost.status).toBe("open");

    const [finalRequest] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, request.id));
    expect(finalRequest.status).toBe("rejected");
  });
});

describe("concurrent cancel", () => {
  it("only one of two simultaneous cancel calls succeeds", async () => {
    const { picker, request, post } = await setUpPendingRequest();

    const [a, b] = await Promise.all([
      authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "PUT" }),
      authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "PUT" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);

    const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    expect(finalPost.status).toBe("open");

    const [finalRequest] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, request.id));
    expect(finalRequest.status).toBe("cancelled");
  });

  it("cannot cancel a request that's already been approved", async () => {
    const { poster, picker, request } = await setUpPendingRequest();

    const approveRes = await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "PUT" });
    expect(approveRes.status).toBe(200);

    const cancelRes = await authedRequest(app, `/requests/${request.id}/cancel`, picker.cookie, { method: "PUT" });
    expect(cancelRes.status).toBe(400);
  });
});

describe("concurrent complete", () => {
  it("only one of two simultaneous complete calls succeeds", async () => {
    const { poster, request, post } = await setUpPendingRequest();

    const approveRes = await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "PUT" });
    expect(approveRes.status).toBe(200);

    const [a, b] = await Promise.all([
      authedRequest(app, `/posts/${post.id}/complete`, poster.cookie, { method: "PUT" }),
      authedRequest(app, `/posts/${post.id}/complete`, poster.cookie, { method: "PUT" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);

    const [finalPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    expect(finalPost.status).toBe("completed");
  });
});

describe("invalid IDs", () => {
  it("returns 404, not a 500, for a malformed request ID", async () => {
    const { poster } = await setUpPendingRequest();
    const res = await authedRequest(app, "/requests/not-a-uuid/approve", poster.cookie, { method: "PUT" });
    expect(res.status).toBe(400);
  });

  it("returns 404, not a 500, for a malformed post ID", async () => {
    const { poster } = await setUpPendingRequest();
    const res = await authedRequest(app, "/posts/not-a-uuid", poster.cookie);
    expect(res.status).toBe(404);
  });
});
