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

import { createApp } from "../src/app.js";
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

async function upload(path: string, cookie: string) {
  const form = new FormData();
  form.append("file", new Blob([PNG], { type: "image/png" }), "photo");
  const res = await app.request(path, { method: "POST", headers: { cookie }, body: form });
  return (await res.json()) as { url?: string; user?: { avatarUrl: string | null } };
}

const nameOf = (url: string) => url.split("/").pop()!;
// Post and request cleanups aren't awaited by the route.
const settle = () => new Promise((r) => setTimeout(r, 50));

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
      diet: "veg", servings: 2, cookedAt: new Date().toISOString(),
    }),
  });
  return (await res.json()).post as { id: string };
}

describe("profile photos", () => {
  it("removes the old photo from storage when a new one replaces it", async () => {
    const user = await createVerifiedUser(app, { email: "avatar-swap@example.com" });
    const first = (await upload("/users/me/avatar", user.cookie)).user!.avatarUrl!;
    expect(removed).not.toHaveBeenCalled();

    const second = (await upload("/users/me/avatar", user.cookie)).user!.avatarUrl!;

    expect(second).not.toBe(first);
    expect(removed).toHaveBeenCalledWith("avatars", [nameOf(first)]);
  });

  it("removes the photo from the profile and from storage", async () => {
    const user = await createVerifiedUser(app, { email: "avatar-remove@example.com" });
    const url = (await upload("/users/me/avatar", user.cookie)).user!.avatarUrl!;

    const res = await authedRequest(app, "/users/me/avatar", user.cookie, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect((await res.json()).user.avatarUrl).toBeNull();
    expect(removed).toHaveBeenCalledWith("avatars", [nameOf(url)]);

    const me = await (await authedRequest(app, "/users/me", user.cookie)).json();
    expect(me.user.avatarUrl).toBeNull();
  });

  it("answers removing a photo that isn't there without touching storage", async () => {
    const user = await createVerifiedUser(app, { email: "no-avatar@example.com" });
    const res = await authedRequest(app, "/users/me/avatar", user.cookie, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(removed).not.toHaveBeenCalled();
  });
});

describe("post photos and selfies", () => {
  it("removes a post's old photo when the poster replaces it", async () => {
    const poster = await createVerifiedUser(app, { email: "photo-swap@example.com" });
    const oldPhoto = (await upload("/posts/photos", poster.cookie)).url!;
    const post = await newPost(poster.cookie, oldPhoto);
    const newPhoto = (await upload("/posts/photos", poster.cookie)).url!;

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, {
      method: "PATCH",
      body: JSON.stringify({
        title: "Rice and dal for 2",
        photoUrl: newPhoto,
        pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
        pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
        diet: "veg", servings: 2, cookedAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(200);
    await settle();

    expect(removed).toHaveBeenCalledWith("food-photos", [nameOf(oldPhoto)]);
    expect(removed).not.toHaveBeenCalledWith("food-photos", [nameOf(newPhoto)]);
  });

  it("removes a deleted post's photo and the selfies of everyone who asked for it", async () => {
    const poster = await createVerifiedUser(app, { email: "delete-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "delete-picker@example.com" });
    const photo = (await upload("/posts/photos", poster.cookie)).url!;
    const post = await newPost(poster.cookie, photo);

    // Asked, declined, so the post is open and can be deleted, with the
    // declined request (and its selfie) still on it.
    const selfie = (await upload("/requests/selfies", picker.cookie)).url!;
    const asked = await authedRequest(app, "/requests", picker.cookie, {
      method: "POST",
      body: JSON.stringify({ postId: post.id, pickerName: "Picker", etaMinutes: 15, selfieUrl: selfie, lat: 13.63, lng: 79.42 }),
    });
    const request = (await asked.json()).request;
    await authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "POST" });

    const res = await authedRequest(app, `/posts/${post.id}`, poster.cookie, { method: "DELETE" });
    expect(res.status).toBe(200);
    await settle();

    expect(removed).toHaveBeenCalledWith("food-photos", [nameOf(photo)]);
    expect(removed).toHaveBeenCalledWith("selfies", [nameOf(selfie)]);
  });
});
