import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { and, eq, lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// Reclaims signups whose verification link expired and was never retried,
// so the email address doesn't stay taken for good. Deletes accounts: only
// ever ones never verified, whatever their token fields say (a verified
// account keeps its used token, see auth.ts). Exported apart from the
// schedule so tests can run it.
export async function runUnverifiedUserCleanup(now = new Date()) {
  const deleted = await db
    .delete(users)
    .where(and(eq(users.emailVerified, false), lt(users.verificationTokenExpiry, now)))
    .returning({ id: users.id });

  if (deleted.length > 0) {
    logger.info({ count: deleted.length }, "Deleted unverified expired user accounts");
  }
  return deleted;
}

export function startUnverifiedUserCleanupJob() {
  // Runs once a day at midnight — the returned task is stopped during
  // graceful shutdown so a restart can't interrupt it mid-run.
  return cron.schedule("0 0 * * *", async () => {
    try {
      await runUnverifiedUserCleanup();
    } catch (err) {
      logger.error({ err }, "Unverified user cleanup job failed");
      Sentry.captureException(err);
    }
  });
}
