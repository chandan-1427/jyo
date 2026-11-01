import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export const RETENTION_DAYS = 14;

// Deletes notifications older than RETENTION_DAYS, read or not. Exported
// apart from the schedule so tests can run it.
export async function runNotificationCleanup(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(notifications)
    .where(lt(notifications.createdAt, cutoff))
    .returning({ id: notifications.id });

  if (deleted.length > 0) {
    logger.info({ count: deleted.length }, "Deleted expired notifications");
  }
  return deleted;
}

export function startNotificationCleanupJob() {
  // Runs once a day at midnight — the returned task is stopped during
  // graceful shutdown so a restart can't interrupt it mid-run.
  return cron.schedule("0 0 * * *", async () => {
    try {
      await runNotificationCleanup();
    } catch (err) {
      logger.error({ err }, "Notification cleanup job failed");
      Sentry.captureException(err);
    }
  });
}
