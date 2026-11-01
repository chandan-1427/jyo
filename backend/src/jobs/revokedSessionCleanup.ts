import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { db } from "../db/index.js";
import { revokedSessions } from "../db/schema.js";
import { lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// A logged-out session only needs remembering until its token would have
// expired anyway; after that the token is refused on its own. Exported apart
// from the schedule so tests can run it.
export async function runRevokedSessionCleanup(now = new Date()) {
  const deleted = await db
    .delete(revokedSessions)
    .where(lt(revokedSessions.expiresAt, now))
    .returning({ jti: revokedSessions.jti });

  if (deleted.length > 0) {
    logger.info({ count: deleted.length }, "Deleted expired revoked sessions");
  }
  return deleted;
}

export function startRevokedSessionCleanupJob() {
  // Daily at 00:30, away from the midnight jobs.
  return cron.schedule("30 0 * * *", async () => {
    try {
      await runRevokedSessionCleanup();
    } catch (err) {
      logger.error({ err }, "Revoked session cleanup job failed");
      Sentry.captureException(err);
    }
  });
}
