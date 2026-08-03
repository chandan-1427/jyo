import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { and, eq, lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export function startUnverifiedUserCleanupJob() {
  // Runs once a day at midnight — the returned task is stopped during
  // graceful shutdown so a restart can't interrupt it mid-run. Reclaims
  // signups whose verification token expired and were never retried, so
  // the email address doesn't stay permanently squatted.
  return cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();

      const deleted = await db
        .delete(users)
        .where(and(eq(users.emailVerified, false), lt(users.verificationTokenExpiry, now)))
        .returning({ id: users.id });

      if (deleted.length > 0) {
        logger.info({ count: deleted.length }, "Deleted unverified expired user accounts");
      }
    } catch (err) {
      logger.error({ err }, "Unverified user cleanup job failed");
      Sentry.captureException(err);
    }
  });
}
