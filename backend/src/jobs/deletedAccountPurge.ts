import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { deleteFile, type Bucket } from "../lib/storage.js";
import { DELETED_ACCOUNT_RETENTION_DAYS, purgeAccount } from "../lib/domain/deleteAccount.js";

// Erases accounts deleted more than DELETED_ACCOUNT_RETENTION_DAYS ago, and
// everything that belonged to them (see lib/domain/deleteAccount.ts). Each
// account is its own transaction, so one failing doesn't hold up the rest.
// Exported apart from the schedule so tests can run it.
export async function runDeletedAccountPurge(now = new Date()) {
  const cutoff = new Date(now.getTime() - DELETED_ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const due = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isDeleted, true), lt(users.deletedAt, cutoff)));

  const purged: string[] = [];
  for (const { id } of due) {
    try {
      const files = await purgeAccount(id);
      const toRemove: [string, Bucket][] = [
        ...(files.avatarUrl ? [[files.avatarUrl, "avatars"] as [string, Bucket]] : []),
        ...files.photoUrls.map((url): [string, Bucket] => [url, "food-photos"]),
        ...files.selfieUrls.map((url): [string, Bucket] => [url, "selfies"]),
      ];
      for (const [url, bucket] of toRemove) await deleteFile(url, bucket);
      purged.push(id);
    } catch (err) {
      logger.error({ err, userId: id }, "Failed to erase a deleted account");
      Sentry.captureException(err);
    }
  }

  if (purged.length > 0) logger.info({ count: purged.length }, "Erased deleted accounts");
  return purged;
}

export function startDeletedAccountPurgeJob() {
  // Daily at 01:00, away from the other nightly jobs.
  return cron.schedule("0 1 * * *", async () => {
    try {
      await runDeletedAccountPurge();
    } catch (err) {
      logger.error({ err }, "Deleted account purge job failed");
      Sentry.captureException(err);
    }
  });
}
