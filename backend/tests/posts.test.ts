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
import { ownUploadUrl } from "./helpers/uploads.js";

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

  it("doesn't reveal the poster's name in the feed or to anyone but the approved picker", async () => {
    const poster = await createVerifiedUser(app, { name: "Lakshmi", email: "name-poster@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);

    const viewer = await createVerifiedUser(app, { email: "name-viewer@example.com" });
    const feed = await (await authedRequest(app, `/posts?lat=${TIRUPATI.lat}&lng=${TIRUPATI.lng}`, viewer.cookie)).json();
    expect(feed.posts[0]).not.toHaveProperty("posterName");
    expect(JSON.stringify(feed)).not.toContain("Lakshmi");

    const picker = await createVerifiedUser(app, { email: "name-picker@example.com" });
    const request = await createRequestFor(picker.cookie, post.id);

    const beforeApproval = await (await authedRequest(app, `/posts/${post.id}`, picker.cookie)).json();
    expect(beforeApproval.post.posterName).toBeNull();

    const approve = await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });
    expect(approve.status).toBe(200);

    const forPicker = await (await authedRequest(app, `/posts/${post.id}`, picker.cookie)).json();
    expect(forPicker.post.posterName).toBe("Lakshmi");

    const forViewer = await (await authedRequest(app, `/posts/${post.id}`, viewer.cookie)).json();
    expect(forViewer.post.posterName).toBeNull();
    expect(JSON.stringify(forViewer)).not.toContain("Lakshmi");
  });

  it("orders open posts by pickup ending soonest, with requested posts last", async () => {
    const poster = await createVerifiedUser(app, { email: "order-poster@example.com" });
    const HOUR = 3_600_000;

    // Created in an order that matches neither creation time nor end time.
    const make = async (title: string, endsInHours: number) => {
      const res = await authedRequest(app, "/posts", poster.cookie, {
        method: "POST",
        body: JSON.stringify({
          title,
          pickupLat: TIRUPATI.lat,
          pickupLng: TIRUPATI.lng,
          pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
          pickupWindowEnd: new Date(Date.now() + endsInHours * HOUR).toISOString(),
        }),
      });
      expect(res.status).toBe(201);
      return (await res.json()).post as { id: string };
    };
    await make("Ends in 5h", 5);
    const requested = await make("Ends in 1h but requested", 1);
    await make("Ends in 2h", 2);
    await make("Ends in 8h", 8);

    const picker = await createVerifiedUser(app, { email: "order-picker@example.com" });
    await createRequestFor(picker.cookie, requested.id);

    const viewer = await createVerifiedUser(app, { email: "order-viewer@example.com" });
    const titles = async () => {
      const res = await authedRequest(app, `/posts?lat=${TIRUPATI.lat}&lng=${TIRUPATI.lng}`, viewer.cookie);
      return (await res.json()).posts.map((p: { title: string }) => p.title);
    };

    const expected = ["Ends in 2h", "Ends in 5h", "Ends in 8h", "Ends in 1h but requested"];
    expect(await titles()).toEqual(expected);
    // Same order on every refresh, so cards don't move between live updates.
    expect(await titles()).toEqual(expected);
  });

  it("requires lat/lng query params", async () => {
    const viewer = await createVerifiedUser(app, { email: "no-coords@example.com" });
    const res = await authedRequest(app, "/posts", viewer.cookie);
    expect(res.status).toBe(400);
  });

  // Regression: a bare parseFloat took "13abc" as 13 and let Infinity and
  // out-of-range values through (and a demo visitor's sample post is placed
  // at these coordinates).
  it("refuses coordinates that aren't plain numbers in range", async () => {
    const viewer = await createVerifiedUser(app, { email: "bad-coords@example.com" });
    const feed = (lat: string, lng: string) =>
      authedRequest(app, `/posts?${new URLSearchParams({ lat, lng })}`, viewer.cookie);

    for (const [lat, lng] of [
      ["13abc", "79.42"],
      ["Infinity", "79.42"],
      ["1e3", "79.42"],
      ["91", "79.42"],
      ["13.63", "-181"],
      ["", "79.42"],
    ]) {
      const res = await feed(lat, lng);
      expect(res.status, `lat=${lat} lng=${lng}`).toBe(400);
      expect((await res.json()).error).toBe("Invalid query");
    }
  });

  it("accepts coordinates rounded to two decimals, as the app sends them", async () => {
    const viewer = await createVerifiedUser(app, { email: "rounded-coords@example.com" });
    const res = await authedRequest(app, "/posts?lat=13.63&lng=79.42", viewer.cookie);
    expect(res.status).toBe(200);
  });
});

describe("photo and selfie addresses", () => {
  const HOUR = 3_600_000;
  const post = (cookie: string, photoUrl: string) =>
    authedRequest(app, "/posts", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Rice and dal for 2",
        photoUrl,
        pickupLat: TIRUPATI.lat,
        pickupLng: TIRUPATI.lng,
        pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
        pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
      }),
    });

  // An image on someone else's server would let it log the IP address, and
  // so the rough location, of everyone who opens the post or request.
  it("only accepts our own uploads for a post's photo", async () => {
    const poster = await createVerifiedUser(app, { email: "own-photo@example.com" });

    expect((await post(poster.cookie, ownUploadUrl("food-photos"))).status).toBe(201);

    const outside = await post(poster.cookie, "https://tracker.example.com/pixel.jpg");
    expect(outside.status).toBe(400);
    expect((await outside.json()).details.photoUrl).toBeDefined();

    // A selfie upload can't be passed off as a food photo either.
    expect((await post(poster.cookie, ownUploadUrl("selfies"))).status).toBe(400);
  });

  it("only accepts our own uploads when a post's photo is changed", async () => {
    const poster = await createVerifiedUser(app, { email: "own-photo-edit@example.com" });
    const created = await createPostAt(poster.cookie, TIRUPATI);

    const res = await authedRequest(app, `/posts/${created.id}`, poster.cookie, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Rice and dal for 2",
        photoUrl: "https://tracker.example.com/pixel.jpg",
        pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
        pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("only accepts our own uploads for a request's selfie", async () => {
    const poster = await createVerifiedUser(app, { email: "own-selfie-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "own-selfie-picker@example.com" });
    const created = await createPostAt(poster.cookie, TIRUPATI);

    const request = (selfieUrl: string) =>
      authedRequest(app, "/requests", picker.cookie, {
        method: "POST",
        body: JSON.stringify({ postId: created.id, pickerName: "Picker", etaMinutes: 15, selfieUrl, ...TIRUPATI }),
      });

    const outside = await request("https://tracker.example.com/me.jpg");
    expect(outside.status).toBe(400);
    expect((await outside.json()).details.selfieUrl).toBeDefined();

    expect((await request(ownUploadUrl("selfies"))).status).toBe(201);
  });

  it("refuses a request on your own post as forbidden", async () => {
    const poster = await createVerifiedUser(app, { email: "own-request@example.com" });
    const created = await createPostAt(poster.cookie, TIRUPATI);

    const res = await authedRequest(app, "/requests", poster.cookie, {
      method: "POST",
      body: JSON.stringify({ postId: created.id, pickerName: "Me", etaMinutes: 15, ...TIRUPATI }),
    });
    expect(res.status).toBe(403);
  });
});

describe("pickup time limit", () => {
  const DAY = 86_400_000;
  const create = (cookie: string, endsInDays: number) =>
    authedRequest(app, "/posts", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Rice and dal for 2",
        pickupLat: TIRUPATI.lat,
        pickupLng: TIRUPATI.lng,
        pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
        pickupWindowEnd: new Date(Date.now() + endsInDays * DAY).toISOString(),
      }),
    });

  it("accepts a pickup ending within a week and rejects one beyond it", async () => {
    const poster = await createVerifiedUser(app, { email: "limit-create@example.com" });

    expect((await create(poster.cookie, 6.5)).status).toBe(201);

    const tooFar = await create(poster.cookie, 8);
    expect(tooFar.status).toBe(400);
    expect((await tooFar.json()).details.pickupWindowEnd).toEqual(["Pickup has to end within 7 days"]);
  });

  it("applies the same limit when a post is edited", async () => {
    const poster = await createVerifiedUser(app, { email: "limit-edit@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Rice and dal for 2",
        pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
        pickupWindowEnd: new Date(Date.now() + 10 * DAY).toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /posts/:id (edit)", () => {
  const HOUR = 3_600_000;
  const edit = (cookie: string, postId: string, changes: Record<string, unknown> = {}) =>
    authedRequest(app, `/posts/${postId}`, cookie, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Rice, dal and curd for 3",
        description: "Made this afternoon",
        pickupWindowStart: new Date(Date.now() + HOUR).toISOString(),
        pickupWindowEnd: new Date(Date.now() + 3 * HOUR).toISOString(),
        ...changes,
      }),
    });

  it("lets the poster change an open post, keeping the photo and spot", async () => {
    const poster = await createVerifiedUser(app, { email: "edit-open@example.com" });
    const photoUrl = ownUploadUrl("food-photos");
    const created = await authedRequest(app, "/posts", poster.cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Rice and dal for 2",
        photoUrl,
        pickupLat: TIRUPATI.lat,
        pickupLng: TIRUPATI.lng,
        pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
        pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
      }),
    });
    const { post } = await created.json();

    const res = await edit(poster.cookie, post.id);
    expect(res.status).toBe(200);
    const { post: updated } = await res.json();
    expect(updated.title).toBe("Rice, dal and curd for 3");
    expect(updated.description).toBe("Made this afternoon");
    expect(updated.photoUrl).toBe(photoUrl);
    expect(updated.pickupLat).toBe(TIRUPATI.lat);
  });

  it("is locked once someone asks for the post, and unlocks if they're declined", async () => {
    const poster = await createVerifiedUser(app, { email: "edit-locked@example.com" });
    const picker = await createVerifiedUser(app, { email: "edit-locked-picker@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);
    const request = await createRequestFor(picker.cookie, post.id);

    const whilePending = await edit(poster.cookie, post.id);
    expect(whilePending.status).toBe(409);
    expect((await whilePending.json()).error).toMatch(/already asked/);

    await authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "POST" });
    expect((await edit(poster.cookie, post.id)).status).toBe(200);
  });

  it("is locked after the poster approves a request", async () => {
    const poster = await createVerifiedUser(app, { email: "edit-approved@example.com" });
    const picker = await createVerifiedUser(app, { email: "edit-approved-picker@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);
    const request = await createRequestFor(picker.cookie, post.id);
    await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });

    expect((await edit(poster.cookie, post.id)).status).toBe(409);
  });

  it("rejects editing someone else's post", async () => {
    const poster = await createVerifiedUser(app, { email: "edit-owner@example.com" });
    const other = await createVerifiedUser(app, { email: "edit-other@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);

    const res = await edit(other.cookie, post.id);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("You can only change your own posts");
  });

  it("applies the same pickup time rules as creating a post", async () => {
    const poster = await createVerifiedUser(app, { email: "edit-times@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);

    const res = await edit(poster.cookie, post.id, {
      pickupWindowStart: new Date(Date.now() + 3 * HOUR).toISOString(),
      pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
    });
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
    expect(res.status).toBe(409);
  });

  it("blocks deleting a closed (approved) post", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-closed@example.com" });
    const picker = await createVerifiedUser(app, { email: "delete-closed-picker@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);
    const request = await createRequestFor(picker.cookie, post.id);
    await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, { method: "DELETE" });
    expect(res.status).toBe(409);
  });

  it("blocks deleting a completed post", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-completed@example.com" });
    const picker = await createVerifiedUser(app, { email: "delete-completed-picker@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);
    const request = await createRequestFor(picker.cookie, post.id);
    await authedRequest(app, `/requests/${request.id}/approve`, poster.cookie, { method: "POST" });
    await authedRequest(app, `/posts/${post.id}/complete`, poster.cookie, { method: "POST" });

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, { method: "DELETE" });
    expect(res.status).toBe(409);
  });

  it("rejects deleting someone else's post", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-owner@example.com" });
    const other = await createVerifiedUser(app, { email: "delete-intruder@example.com" });
    const post = await createPostAt(poster.cookie, TIRUPATI);

    const res = await authedRequest(app, `/posts/${post.id}`, other.cookie, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
