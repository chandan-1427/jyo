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
import { sendPasswordResetEmail } from "../src/lib/mailer.js";
import { runDeletedAccountPurge } from "../src/jobs/deletedAccountPurge.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();
const DAY = 24 * 60 * 60 * 1000;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

beforeEach(async () => {
  await resetDb();
  removed.mockReset();
  vi.clearAllMocks();
});

const settle = () => new Promise((r) => setTimeout(r, 100));
const nameOf = (url: string) => url.split("/").pop()!;
const later = (ms: number) => new Date(Date.now() + ms);

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
const postJson = (path: string, body: unknown) =>
  app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const deleteAccount = (cookie: string, password = "password123") =>
  authedRequest(app, "/users/me", cookie, { method: "DELETE", body: JSON.stringify({ password }) });

// A person with a profile photo and a post with a photo that a neighbour
// asked for (with a selfie) and was declined, who also collected the
// neighbour's food (with a selfie of their own).
async function someoneWithHistory() {
  const leaving = await createVerifiedUser(app, { email: `leaving-${Math.random()}@example.com`, name: "Leaving Person" });
  const neighbour = await createVerifiedUser(app, { email: `neighbour-${Math.random()}@example.com` });

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
  removed.mockReset();

  return { leaving, neighbour, avatar, photo, theirPost, neighbourSelfie, declined, neighbourPost, theirSelfie, collected };
}

describe("deleting your account", () => {
  it("keeps the account, hidden, with its details, and deletes its photos now", async () => {
    const s = await someoneWithHistory();

    const res = await deleteAccount(s.leaving.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/token=;.*Max-Age=0/);
    await settle();

    const [row] = await db.select().from(users).where(eq(users.id, s.leaving.userId));
    expect(row).toMatchObject({ isDeleted: true, name: "Leaving Person", email: s.leaving.email, avatarUrl: null });
    expect(row.deletedAt).toBeInstanceOf(Date);

    // Its posts and requests are kept, without their pictures.
    const [post] = await db.select().from(foodPosts).where(eq(foodPosts.id, s.theirPost.id));
    expect(post.photoUrl).toBeNull();
    const [mine] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, s.collected.id));
    expect(mine.selfieUrl).toBeNull();
    expect(await db.select().from(notifications).where(eq(notifications.userId, s.leaving.userId))).not.toHaveLength(0);

    // Its own photos are gone from storage; the neighbour's selfie isn't theirs to remove.
    expect(removed).toHaveBeenCalledWith("avatars", [nameOf(s.avatar)]);
    expect(removed).toHaveBeenCalledWith("food-photos", [nameOf(s.photo)]);
    expect(removed).toHaveBeenCalledWith("selfies", [nameOf(s.theirSelfie)]);
    expect(removed).not.toHaveBeenCalledWith("selfies", [nameOf(s.neighbourSelfie)]);
  });

  it("hides the account's posts from everyone and every action", async () => {
    const s = await someoneWithHistory();
    const viewer = await createVerifiedUser(app, { email: "viewer@example.com" });
    const open = await newPost(s.leaving.cookie);

    await deleteAccount(s.leaving.cookie);

    const feed = await (await authedRequest(app, "/posts?lat=13.63&lng=79.42", viewer.cookie)).json();
    expect(feed.posts.map((p: { id: string }) => p.id)).not.toContain(open.id);
    expect((await authedRequest(app, `/posts/${open.id}`, viewer.cookie)).status).toBe(404);
    expect(
      (
        await authedRequest(app, "/requests", viewer.cookie, {
          method: "POST",
          body: JSON.stringify({ postId: open.id, pickerName: "Picker", etaMinutes: 15, lat: 13.63, lng: 79.42 }),
        })
      ).status
    ).toBe(404);

    // The neighbour's declined request on that post leaves their history; their own post and pickup stay.
    const history = await (await authedRequest(app, "/requests/mine", s.neighbour.cookie)).json();
    expect(history.requests.map((r: { id: string }) => r.id)).not.toContain(s.declined.id);
    expect((await authedRequest(app, `/posts/${s.neighbourPost.id}`, s.neighbour.cookie)).status).toBe(200);
  });

  it("ends every session, and the account can't be logged into or reset", async () => {
    const user = await createVerifiedUser(app, { email: "gone@example.com" });
    const login = await postJson("/auth/login", { email: user.email, password: "password123" });
    const otherDevice = login.headers.get("set-cookie")!.split(";")[0];

    await deleteAccount(user.cookie);

    for (const cookie of [user.cookie, otherDevice]) {
      expect((await authedRequest(app, "/users/me", cookie)).status).toBe(401);
    }
    const again = await postJson("/auth/login", { email: user.email, password: "password123" });
    expect(again.status).toBe(401);
    expect((await again.json()).error).toBe("Invalid email or password");

    await postJson("/auth/forgot-password", { email: user.email });
    expect(vi.mocked(sendPasswordResetEmail)).not.toHaveBeenCalled();
  });

  // Same email, new account: nothing from the deleted one comes back.
  it("lets the same person sign up again as a fresh account", async () => {
    const before = await createVerifiedUser(app, { email: "come-back@example.com", name: "First Time" });
    const oldPost = await newPost(before.cookie);
    await deleteAccount(before.cookie);

    const after = await createVerifiedUser(app, { email: "come-back@example.com", name: "Second Time" });
    expect(after.userId).not.toBe(before.userId);

    const me = await (await authedRequest(app, "/users/me", after.cookie)).json();
    expect(me.user).toMatchObject({ name: "Second Time", avatarUrl: null, isDemo: false });
    const posts = await (await authedRequest(app, "/posts/mine", after.cookie)).json();
    expect(posts.posts.map((p: { id: string }) => p.id)).not.toContain(oldPost.id);
    expect((await authedRequest(app, `/posts/${oldPost.id}`, after.cookie)).status).toBe(404);

    // The old account is still kept, deleted, alongside.
    const rows = await db.select().from(users).where(eq(users.email, "come-back@example.com"));
    expect(rows.map((r) => r.isDeleted).sort()).toEqual([false, true]);
  });

  it("still allows only one live account per email", async () => {
    await createVerifiedUser(app, { email: "taken@example.com" });
    const res = await postJson("/auth/register", { name: "Copy Cat", email: "taken@example.com", password: "password123", phone: "9876543210" });
    expect(res.status).toBe(409);
  });

  it("works for a demo visitor too", async () => {
    const visitor = await createVerifiedUser(app, { email: "demo-leaving@example.com" });
    await act(visitor.cookie, "/auth/demo/start");
    await authedRequest(app, "/posts?lat=13.63&lng=79.42", visitor.cookie);
    expect((await deleteAccount(visitor.cookie)).status).toBe(200);
  });
});

describe("erasing deleted accounts after 30 days", () => {
  it("erases the account and everything that was its, and nothing else", async () => {
    const s = await someoneWithHistory();
    await deleteAccount(s.leaving.cookie);
    await settle();
    removed.mockReset();

    // Kept for 30 days...
    expect(await runDeletedAccountPurge(later(29 * DAY))).toEqual([]);
    expect(await db.select().from(users).where(eq(users.id, s.leaving.userId))).toHaveLength(1);

    // ...then gone, with its posts, every request on them and its own requests.
    expect(await runDeletedAccountPurge(later(31 * DAY))).toEqual([s.leaving.userId]);
    expect(await db.select().from(users).where(eq(users.id, s.leaving.userId))).toHaveLength(0);
    expect(await db.select().from(foodPosts).where(eq(foodPosts.posterId, s.leaving.userId))).toHaveLength(0);
    expect(
      await db
        .select()
        .from(pickupRequests)
        .where(or(eq(pickupRequests.pickerId, s.leaving.userId), eq(pickupRequests.postId, s.theirPost.id)))
    ).toHaveLength(0);
    expect(await db.select().from(notifications).where(eq(notifications.userId, s.leaving.userId))).toHaveLength(0);
    // The neighbour's selfie went with the post it was attached to.
    expect(removed).toHaveBeenCalledWith("selfies", [nameOf(s.neighbourSelfie)]);

    // The neighbour keeps everything of theirs.
    const [kept] = await db.select().from(foodPosts).where(eq(foodPosts.id, s.neighbourPost.id));
    expect(kept).toMatchObject({ status: "completed", approvedRequestId: null });
    expect((await authedRequest(app, "/users/me", s.neighbour.cookie)).status).toBe(200);
  });

  it("leaves a new account with the same email alone", async () => {
    const before = await createVerifiedUser(app, { email: "twice@example.com" });
    await deleteAccount(before.cookie);
    const after = await createVerifiedUser(app, { email: "twice@example.com" });
    await newPost(after.cookie);

    await runDeletedAccountPurge(later(31 * DAY));

    expect(await db.select().from(users).where(eq(users.email, "twice@example.com"))).toHaveLength(1);
    expect((await authedRequest(app, "/users/me", after.cookie)).status).toBe(200);
  });
});

describe("what deleting your account requires", () => {
  it("refuses a wrong password, changing nothing", async () => {
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
  // deletion is refused) or finds the post gone; never both.
  it("never lets a request land on a deleted account's post at the same moment", async () => {
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

      const requests = await db.select().from(pickupRequests).where(eq(pickupRequests.postId, post.id));
      if (deleted.status === 200) {
        expect([404, 409]).toContain(asked.status);
        expect(requests).toHaveLength(0);
      } else {
        expect(deleted.status).toBe(409);
        expect(asked.status).toBe(201);
        expect(requests).toHaveLength(1);
      }
    }
  });
});
