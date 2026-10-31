import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

// Storage is faked per bucket: each test says which files exist and how old
// they are, and sees what was removed.
type File = { name: string; created_at: string; id: string | null };
const buckets: Record<string, File[]> = {};
const removed: Record<string, string[]> = {};
const listError = { value: null as null | { message: string } };

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        list: async (_path: string, { limit, offset }: { limit: number; offset: number }) =>
          listError.value
            ? { data: null, error: listError.value }
            : { data: (buckets[bucket] ?? []).slice(offset, offset + limit), error: null },
        remove: async (names: string[]) => {
          (removed[bucket] ??= []).push(...names);
          return { error: null };
        },
        getPublicUrl: (name: string) => ({ data: { publicUrl: `https://storage.test/${bucket}/${name}` } }),
      }),
    },
  }),
}));

import crypto from "crypto";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, pickupRequests, users } from "../src/db/schema.js";
import { MAX_DELETES_PER_BUCKET, sweepOrphanedUploads } from "../src/jobs/orphanedUploadCleanup.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser } from "./helpers/auth.js";

const app = createApp();
const DAY = 24 * 60 * 60 * 1000;

const uploadName = () => `${crypto.randomUUID()}.jpg`;
const url = (bucket: string, name: string) => `https://storage.test/${bucket}/${name}`;

function stored(bucket: string, name: string, ageMs: number) {
  (buckets[bucket] ??= []).push({ name, created_at: new Date(Date.now() - ageMs).toISOString(), id: crypto.randomUUID() });
  return name;
}

async function postWithPhoto(posterId: string, photoUrl: string | null) {
  const [post] = await db
    .insert(foodPosts)
    .values({
      posterId,
      title: "Rice",
      photoUrl,
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(),
      pickupWindowEnd: new Date(Date.now() + DAY),
    })
    .returning();
  return post;
}

const result = (results: Awaited<ReturnType<typeof sweepOrphanedUploads>>, bucket: string) =>
  results.find((r) => r.bucket === bucket)!;

beforeEach(async () => {
  await resetDb();
  for (const key of Object.keys(buckets)) delete buckets[key];
  for (const key of Object.keys(removed)) delete removed[key];
  listError.value = null;
});

describe("cleaning up unused uploads", () => {
  it("removes old unused files and keeps everything a post, request or profile uses", async () => {
    const user = await createVerifiedUser(app, { email: "sweep@example.com" });

    const photo = stored("food-photos", uploadName(), 5 * DAY);
    const post = await postWithPhoto(user.userId, url("food-photos", photo));
    const selfie = stored("selfies", uploadName(), 5 * DAY);
    await db.insert(pickupRequests).values({
      postId: post.id,
      pickerId: user.userId,
      pickerName: "P",
      etaMinutes: 10,
      selfieUrl: url("selfies", selfie),
    });
    const avatar = stored("avatars", uploadName(), 5 * DAY);
    await db.update(users).set({ avatarUrl: url("avatars", avatar) }).where(eq(users.id, user.userId));

    const unusedPhoto = stored("food-photos", uploadName(), 5 * DAY);
    const unusedSelfie = stored("selfies", uploadName(), 5 * DAY);
    const oldAvatar = stored("avatars", uploadName(), 5 * DAY);

    const results = await sweepOrphanedUploads();

    expect(removed["food-photos"]).toEqual([unusedPhoto]);
    expect(removed["selfies"]).toEqual([unusedSelfie]);
    expect(removed["avatars"]).toEqual([oldAvatar]);
    expect(result(results, "food-photos")).toMatchObject({ files: 2, referenced: 1, unused: 1, deleted: 1 });
  });

  it("leaves recent uploads alone, since a form may be about to use them", async () => {
    stored("food-photos", uploadName(), 60 * 60 * 1000);
    stored("food-photos", uploadName(), 1.5 * DAY);
    await sweepOrphanedUploads();
    expect(removed["food-photos"]).toBeUndefined();
  });

  it("never touches files it didn't name itself", async () => {
    stored("food-photos", "logo.png", 30 * DAY);
    stored("food-photos", ".emptyFolderPlaceholder", 30 * DAY);
    await sweepOrphanedUploads();
    expect(removed["food-photos"]).toBeUndefined();
  });

  it("ignores folders in the listing", async () => {
    (buckets["food-photos"] ??= []).push({ name: "archive", created_at: new Date(0).toISOString(), id: null });
    await sweepOrphanedUploads();
    expect(removed["food-photos"]).toBeUndefined();
  });

  it("deletes nothing on a dry run, but reports what it would", async () => {
    stored("food-photos", uploadName(), 5 * DAY);
    const results = await sweepOrphanedUploads({ dryRun: true });
    expect(removed["food-photos"]).toBeUndefined();
    expect(result(results, "food-photos")).toMatchObject({ unused: 1, deleted: 0 });
  });

  it("deletes nothing in a bucket whose stored addresses match none of its files", async () => {
    // As if the storage address changed: rows point elsewhere, so every
    // file would look unused.
    const user = await createVerifiedUser(app, { email: "mismatch@example.com" });
    await postWithPhoto(user.userId, `https://old-project.test/food-photos/${uploadName()}`);
    stored("food-photos", uploadName(), 5 * DAY);
    stored("food-photos", uploadName(), 5 * DAY);

    const results = await sweepOrphanedUploads();

    expect(removed["food-photos"]).toBeUndefined();
    expect(result(results, "food-photos").skipped).toBeDefined();
  });

  it("removes at most a set number of files per run", async () => {
    for (let i = 0; i < MAX_DELETES_PER_BUCKET + 20; i++) stored("selfies", uploadName(), 5 * DAY);
    const results = await sweepOrphanedUploads();
    expect(removed["selfies"]).toHaveLength(MAX_DELETES_PER_BUCKET);
    expect(result(results, "selfies")).toMatchObject({ unused: MAX_DELETES_PER_BUCKET + 20, deleted: MAX_DELETES_PER_BUCKET });
  });

  it("reads past the first page of a large bucket", async () => {
    const user = await createVerifiedUser(app, { email: "paging@example.com" });
    for (let i = 0; i < 1500; i++) stored("food-photos", uploadName(), 5 * DAY);
    const kept = buckets["food-photos"][1200].name;
    await postWithPhoto(user.userId, url("food-photos", kept));

    const results = await sweepOrphanedUploads({ dryRun: true });
    expect(result(results, "food-photos")).toMatchObject({ files: 1500, referenced: 1, unused: 1499 });
  });

  it("deletes nothing when the bucket can't be listed", async () => {
    stored("food-photos", uploadName(), 5 * DAY);
    listError.value = { message: "storage down" };
    await expect(sweepOrphanedUploads()).rejects.toThrow(/Listing food-photos failed/);
    expect(removed["food-photos"]).toBeUndefined();
  });
});
