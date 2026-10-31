import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { isNotNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { isUploadName, listUploads, removeUploads, uploadNameFromUrl, type Bucket } from "../lib/storage.js";

// Images are uploaded before the post, request or profile that uses them is
// saved, so some are never used: a form abandoned after the upload, a retry
// that uploaded again, demo content swept away, a deleted account. Nothing
// else removes those, so they would pile up in storage for good.

// Old enough that no form still open in someone's browser can be about to
// use it.
const GRACE_MS = 2 * 24 * 60 * 60 * 1000;

// A ceiling on how much one run can remove; the rest waits for the next run.
export const MAX_DELETES_PER_BUCKET = 500;

const REFERENCES: Record<Bucket, () => Promise<(string | null)[]>> = {
  "food-photos": async () =>
    (await db.select({ url: foodPosts.photoUrl }).from(foodPosts).where(isNotNull(foodPosts.photoUrl))).map((r) => r.url),
  selfies: async () =>
    (await db.select({ url: pickupRequests.selfieUrl }).from(pickupRequests).where(isNotNull(pickupRequests.selfieUrl))).map((r) => r.url),
  avatars: async () =>
    (await db.select({ url: users.avatarUrl }).from(users).where(isNotNull(users.avatarUrl))).map((r) => r.url),
};

export type SweepResult = {
  bucket: Bucket;
  files: number;
  referenced: number;
  unused: number;
  deleted: number;
  skipped?: string;
};

export async function sweepOrphanedUploads({ dryRun = false, now = new Date() } = {}): Promise<SweepResult[]> {
  const results: SweepResult[] = [];

  for (const bucket of Object.keys(REFERENCES) as Bucket[]) {
    const files = await listUploads(bucket);
    const urls = await REFERENCES[bucket]();
    const used = new Set(urls.map((url) => url && uploadNameFromUrl(url, bucket)).filter((n): n is string => !!n));
    const present = new Set(files.map((f) => f.name));
    const referenced = [...used].filter((name) => present.has(name)).length;

    const unused = files
      .filter((f) => isUploadName(f.name) && !used.has(f.name) && now.getTime() - f.createdAt.getTime() > GRACE_MS)
      .map((f) => f.name);

    const result: SweepResult = { bucket, files: files.length, referenced, unused: unused.length, deleted: 0 };

    // Rows point at images, yet none of them is in the bucket: the stored
    // addresses and the storage client disagree (a changed project URL or
    // domain), so everything would look unused. Delete nothing.
    if (urls.length > 0 && referenced === 0 && files.length > 0) {
      result.skipped = "no stored address matches a file in this bucket";
    } else if (!dryRun && unused.length > 0) {
      const batch = unused.slice(0, MAX_DELETES_PER_BUCKET);
      await removeUploads(bucket, batch);
      result.deleted = batch.length;
    }

    results.push(result);
  }

  return results;
}

export function startOrphanedUploadCleanupJob() {
  // Daily at 03:30, away from the midnight jobs and from busy hours.
  return cron.schedule("30 3 * * *", async () => {
    try {
      const results = await sweepOrphanedUploads();
      for (const r of results) {
        if (r.skipped) {
          logger.error(r, "Skipped orphaned upload cleanup for a bucket");
          Sentry.captureMessage(`Orphaned upload cleanup skipped ${r.bucket}: ${r.skipped}`, "warning");
        } else if (r.deleted > 0) {
          logger.info(r, "Deleted unused uploads");
        }
      }
    } catch (err) {
      logger.error({ err }, "Orphaned upload cleanup job failed");
      Sentry.captureException(err);
    }
  });
}
