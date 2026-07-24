import { describe, it, expect, vi, beforeEach } from "vitest";

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
// Chennai — ~110km from Tirupati, well outside the 20km feed radius.
const CHENNAI = { lat: 13.0827, lng: 80.2707 };

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

async function createPostAt(cookie: string, coords: { lat: number; lng: number }, title = "Rice and dal for 2") {
  const res = await authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title,
      pickupLat: coords.lat,
      pickupLng: coords.lng,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.post as { id: string };
}

async function createRequestFor(cookie: string, postId: string) {
  const res = await authedRequest(app, "/requests", cookie, {
    method: "POST",
    body: JSON.stringify({
      postId,
      pickerName: "Picker",
      etaMinutes: 15,
      lat: TIRUPATI.lat,
      lng: TIRUPATI.lng,
    }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.request as { id: string };
}

describe("GET /posts (feed)", () => {
  it("only returns posts within the 20km radius of the query point", async () => {
    const poster = await createVerifiedUser(app, { email: "feed-poster@example.com" });
    const nearby = await createPostAt(poster.cookie, TIRUPATI, "Nearby food");
    await createPostAt(poster.cookie, CHENNAI, "Far away food");

    const viewer = await createVerifiedUser(app, { email: "feed-viewer@example.com" });
    const res = await authedRequest(app, `/posts?lat=${TIRUPATI.lat}&lng=${TIRUPATI.lng}`, viewer.cookie);
    expect(res.status).toBe(200);

    const body = await res.json();
    const ids = body.posts.map((p: { id: string }) => p.id);
    expect(ids).toContain(nearby.id);
    expect(ids).toHaveLength(1);
  });

  it("hides exact pickup coordinates from the feed response", async () => {
    const poster = await createVerifiedUser(app, { email: "privacy-poster@example.com" });
    await createPostAt(poster.cookie, TIRUPATI);

    const viewer = await createVerifiedUser(app, { email: "privacy-viewer@example.com" });
    const res = await authedRequest(app, `/posts?lat=${TIRUPATI.lat}&lng=${TIRUPATI.lng}`, viewer.cookie);
    const body = await res.json();

    expect(body.posts[0].pickupLat).toBeUndefined();
    expect(body.posts[0].pickupLng).toBeUndefined();
  });

  it("requires lat/lng query params", async () => {
    const viewer = await createVerifiedUser(app, { email: "no-coords@example.com" });
    const res = await authedRequest(app, "/posts", viewer.cookie);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /posts/:id", () => {
  it("allows deleting an open post", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-open@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("blocks deleting a post with a pending request", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-pending@example.com" });
    const picker = await createVerifiedUser(app, { email: "delete-pending-picker@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);
    await createRequestFor(picker.cookie, post.id);

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("blocks deleting a closed (approved) post", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-closed@example.com" });
    const picker = await createVerifiedUser(app, { email: "delete-closed-picker@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);
    const request = await createRequestFor(picker.cookie, post.id);
    await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "PUT" });

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("blocks deleting a completed post", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-completed@example.com" });
    const picker = await createVerifiedUser(app, { email: "delete-completed-picker@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);
    const request = await createRequestFor(picker.cookie, post.id);
    await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "PUT" });
    await authedRequest(app, `/posts/${post.id}/complete`, poster.cookie, { method: "PUT" });

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, { method: "DELETE" });
    expect(res.status).toBe(400);
  });

  it("rejects deleting someone else's post", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-owner@example.com" });
    const other = await createVerifiedUser(app, { email: "delete-intruder@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);

    const res = await authedRequest(app, `/posts/${post.id}`, other.cookie, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
