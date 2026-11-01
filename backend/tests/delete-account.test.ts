import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

// Storage is faked per bucket, recording what the app removes.
const removed = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: (name: string) => ({ data: { publicUrl: `https://storage.test/${name}` } }),
        remove: async (names: string[]) => {
          removed(bucket, names);
          return { error: null };
        },
      }),
    },
  }),
}));

import { eq, or } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, notifications, pickupRequests, users } from "../src/db/schema.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

beforeEach(async () => {
  await resetDb();
  removed.mockReset();
});

const settle = () => new Promise((r) => setTimeout(r, 100));
const nameOf = (url: string) => url.split("/").pop()!;

async function upload(path: string, cookie: string) {
  const form = new FormData();
  form.append("file", new Blob([PNG], { type: "image/png" }), "photo");
  const body = await (await app.request(path, { method: "POST", headers: { cookie }, body: form })).json();
  return (body.url ?? body.user.avatarUrl) as string;
}

async function newPost(cookie: string, photoUrl?: string) {
  const res = await authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Rice and dal for 2",
      photoUrl,
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  });
  return (await res.json()).post as { id: string };
}

async function askFor(cookie: string, postId: string, selfieUrl?: string) {
  const res = await authedRequest(app, "/requests", cookie, {
    method: "POST",
    body: JSON.stringify({ postId, pickerName: "Picker", etaMinutes: 15, selfieUrl, lat: 13.63, lng: 79.42 }),
  });
  return (await res.json()).request as { id: string };
}

const act = (cookie: string, path: string) => authedRequest(app, path, cookie, { method: "POST" });

const deleteAccount = (cookie: string, password = "password123") =>
  authedRequest(app, "/users/me", cookie, { method: "DELETE", body: JSON.stringify({ password }) });

describe("deleting your account", () => {
  it("removes the account and everything that belongs to it, and nobody else's", async () => {
    const leaving = await createVerifiedUser(app, { email: "leaving@example.com" });
    const neighbour = await createVerifiedUser(app, { email: "neighbour@example.com" });

    // Their profile photo, an open post with a photo that the neighbour asked
    // for and was declined, and an old pickup of the neighbour's food.
    const avatar = await upload("/users/me/avatar", leaving.cookie);
    const photo = await upload("/posts/photos", leaving.cookie);
    const theirPost = await newPost(leaving.cookie, photo);
    const neighbourSelfie = await upload("/requests/selfies", neighbour.cookie);
    const declined = await askFor(neighbour.cookie, theirPost.id, neighbourSelfie);
    await act(leaving.cookie, `/requests/${declined.id}/reject`);

    const neighbourPost = await newPost(neighbour.cookie);
    const theirSelfie = await upload("/requests/selfies", leaving.cookie);
    const collected = await askFor(leaving.cookie, neighbourPost.id, theirSelfie);
    await act(neighbour.cookie, `/requests/${collected.id}/approve`);
    await act(neighbour.cookie, `/posts/${neighbourPost.id}/complete`);
    await settle();

    const res = await deleteAccount(leaving.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/token=;.*Max-Age=0/);
    await settle();

    // Gone: the account, its post, every request on its post and its own requests, its notifications.
    expect(await db.select().from(users).where(eq(users.id, leaving.userId))).toHaveLength(0);
    expect(await db.select().from(foodPosts).where(eq(foodPosts.posterId, leaving.userId))).toHaveLength(0);
    expect(
      await db
        .select()
        .from(pickupRequests)
        .where(or(eq(pickupRequests.pickerId, leaving.userId), eq(pickupRequests.postId, theirPost.id)))
    ).toHaveLength(0);
    expect(await db.select().from(notifications).where(eq(notifications.userId, leaving.userId))).toHaveLength(0);

    // And its files.
    expect(removed).toHaveBeenCalledWith("avatars", [nameOf(avatar)]);
    expect(removed).toHaveBeenCalledWith("food-photos", [nameOf(photo)]);
    expect(removed).toHaveBeenCalledWith("selfies", [nameOf(theirSelfie)]);
    expect(removed).toHaveBeenCalledWith("selfies", [nameOf(neighbourSelfie)]);

    // The neighbour keeps their account, their post (now without a pointer
    // to the deleted request) and their notifications, minus links to the
    // deleted post.
    const [kept] = await db.select().from(foodPosts).where(eq(foodPosts.id, neighbourPost.id));
    expect(kept).toMatchObject({ status: "completed", approvedRequestId: null });
    const theirNotes = await db.select().from(notifications).where(eq(notifications.userId, neighbour.userId));
    expect(theirNotes.length).toBeGreaterThan(0);
    expect(theirNotes.every((n) => n.postId !== theirPost.id)).toBe(true);
    expect((await authedRequest(app, "/users/me", neighbour.cookie)).status).toBe(200);
  });

  it("ends every session of the account, on every device", async () => {
    const user = await createVerifiedUser(app, { email: "all-devices@example.com" });
    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: "password123" }),
    });
    const otherDevice = login.headers.get("set-cookie")!.split(";")[0];

    await deleteAccount(user.cookie);

    for (const cookie of [user.cookie, otherDevice]) {
      expect((await authedRequest(app, "/users/me", cookie)).status).toBe(401);
    }
  });

  it("frees the email address for a new sign-up", async () => {
    const user = await createVerifiedUser(app, { email: "come-back@example.com" });
    await deleteAccount(user.cookie);
    const again = await createVerifiedUser(app, { email: "come-back@example.com" });
    expect(again.userId).not.toBe(user.userId);
  });

  it("takes the account's open posts out of the feed", async () => {
    const leaving = await createVerifiedUser(app, { email: "feed-leaving@example.com" });
    const viewer = await createVerifiedUser(app, { email: "feed-viewer@example.com" });
    const post = await newPost(leaving.cookie);

    await deleteAccount(leaving.cookie);

    const feed = await (await authedRequest(app, "/posts?lat=13.63&lng=79.42", viewer.cookie)).json();
    expect(feed.posts.map((p: { id: string }) => p.id)).not.toContain(post.id);
    expect((await authedRequest(app, `/posts/${post.id}`, viewer.cookie)).status).toBe(404);
  });

  it("removes a demo visitor's seeded demo posts too", async () => {
    const visitor = await createVerifiedUser(app, { email: "demo-leaving@example.com" });
    await act(visitor.cookie, "/auth/demo/start");
    await authedRequest(app, "/posts?lat=13.63&lng=79.42", visitor.cookie);
    expect(await db.select().from(foodPosts).where(eq(foodPosts.seededForUserId, visitor.userId))).toHaveLength(1);

    expect((await deleteAccount(visitor.cookie)).status).toBe(200);
    expect(await db.select().from(foodPosts).where(eq(foodPosts.seededForUserId, visitor.userId))).toHaveLength(0);
  });
});

describe("what deleting your account requires", () => {
  it("refuses a wrong password, deleting nothing", async () => {
    const user = await createVerifiedUser(app, { email: "wrong-password@example.com" });

    const res = await deleteAccount(user.cookie, "not-my-password");
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("That password isn't right.");
    expect((await authedRequest(app, "/users/me", user.cookie)).status).toBe(200);
  });

  it("asks for the password", async () => {
    const user = await createVerifiedUser(app, { email: "no-password@example.com" });
    const res = await authedRequest(app, "/users/me", user.cookie, { method: "DELETE", body: JSON.stringify({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).details.password).toBeDefined();
  });

  it("needs a session", async () => {
    const res = await app.request("/users/me", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "password123" }),
    });
    expect(res.status).toBe(401);
  });
});

// Someone may be on their way: the account stays until the pickup is
// answered, cancelled or finished.
describe("while a pickup is in progress", () => {
  async function setUp() {
    const poster = await createVerifiedUser(app, { email: `busy-poster-${Math.random()}@example.com` });
    const picker = await createVerifiedUser(app, { email: `busy-picker-${Math.random()}@example.com` });
    const post = await newPost(poster.cookie);
    const request = await askFor(picker.cookie, post.id);
    return { poster, picker, post, request };
  }

  it("refuses while someone's request is waiting on your post, or you're waiting on theirs", async () => {
    const { poster, picker } = await setUp();
    for (const who of [poster, picker]) {
      const res = await deleteAccount(who.cookie);
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/pickup in progress/);
      expect((await authedRequest(app, "/users/me", who.cookie)).status).toBe(200);
    }
  });

  it("refuses while an approved pickup hasn't been collected, on either side", async () => {
    const { poster, picker, request } = await setUp();
    await act(poster.cookie, `/requests/${request.id}/approve`);
    for (const who of [poster, picker]) expect((await deleteAccount(who.cookie)).status).toBe(409);
  });

  it("allows it once the pickup is done", async () => {
    const { poster, picker, post, request } = await setUp();
    await act(poster.cookie, `/requests/${request.id}/approve`);
    await act(poster.cookie, `/posts/${post.id}/complete`);
    expect((await deleteAccount(picker.cookie)).status).toBe(200);
    expect((await deleteAccount(poster.cookie)).status).toBe(200);
  });

  // A request arriving at the same moment either lands first (and the
  // deletion is refused) or finds the post gone; never a half-deleted mix.
  it("never leaves a request on a deleted post when one arrives at the same moment", async () => {
    for (let i = 0; i < 5; i++) {
      const leaving = await createVerifiedUser(app, { email: `race-leaving-${i}@example.com` });
      const picker = await createVerifiedUser(app, { email: `race-picker-${i}@example.com` });
      const post = await newPost(leaving.cookie);

      const [deleted, asked] = await Promise.all([
        deleteAccount(leaving.cookie),
        authedRequest(app, "/requests", picker.cookie, {
          method: "POST",
          body: JSON.stringify({ postId: post.id, pickerName: "Picker", etaMinutes: 15, lat: 13.63, lng: 79.42 }),
        }),
      ]);

      const posts = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
      const requests = await db.select().from(pickupRequests).where(eq(pickupRequests.postId, post.id));
      if (deleted.status === 200) {
        expect([404, 409]).toContain(asked.status);
        expect(posts).toHaveLength(0);
        expect(requests).toHaveLength(0);
      } else {
        expect(deleted.status).toBe(409);
        expect(asked.status).toBe(201);
        expect(posts).toHaveLength(1);
        expect(requests).toHaveLength(1);
      }
    }
  });
});
