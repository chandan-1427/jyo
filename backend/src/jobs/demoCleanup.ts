import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { db } from "../db/index.js";
import { notifications, pickupRequests, foodPosts, users } from "../db/schema.js";
import { and, isNotNull, lt, inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { isSyntheticEmail } from "../lib/demo.js";

// Deletes everything tagged with a past demoExpiresAt, in FK-safe order:
// notifications -> pickupRequests -> foodPosts -> users. Mirrors the
// manual child-first deletion already used in posts.ts's DELETE /:id route.
// A user row is only ever deleted if it's a synthetic counterparty
// (@jyo.internal email, created by lib/demo.ts to stand in for the other
// side of a demo interaction) — a REAL account that opted into demo mode
// via POST /auth/demo/start just gets its isDemo flag reset, never deleted,
// since a real person's account must survive their demo session ending.
// See docs/demo-mode-plan.md. Exported separately from the cron wrapper so
// tests can invoke it directly instead of waiting on a schedule.
export async function runDemoCleanup() {
  const now = new Date();

  const deletedNotifications = await db
    .delete(notifications)
    .where(and(isNotNull(notifications.demoExpiresAt), lt(notifications.demoExpiresAt, now)))
    .returning({ id: notifications.id });

  const deletedRequests = await db
    .delete(pickupRequests)
    .where(and(isNotNull(pickupRequests.demoExpiresAt), lt(pickupRequests.demoExpiresAt, now)))
    .returning({ id: pickupRequests.id });

  const deletedPosts = await db
    .delete(foodPosts)
    .where(and(isNotNull(foodPosts.demoExpiresAt), lt(foodPosts.demoExpiresAt, now)))
    .returning({ id: foodPosts.id });

  const expiredUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(isNotNull(users.demoExpiresAt), lt(users.demoExpiresAt, now)));

  const syntheticIds = expiredUsers.filter((u) => isSyntheticEmail(u.email)).map((u) => u.id);
  const realIds = expiredUsers.filter((u) => !isSyntheticEmail(u.email)).map((u) => u.id);

  const deletedUsers = syntheticIds.length
    ? await db.delete(users).where(inArray(users.id, syntheticIds)).returning({ id: users.id })
    : [];

  if (realIds.length) {
    await db.update(users).set({ isDemo: false, demoExpiresAt: null }).where(inArray(users.id, realIds));
  }

  const total =
    deletedNotifications.length + deletedRequests.length + deletedPosts.length + deletedUsers.length;

  if (total > 0 || realIds.length > 0) {
    logger.info(
      {
        notifications: deletedNotifications.length,
        pickupRequests: deletedRequests.length,
        foodPosts: deletedPosts.length,
        usersDeleted: deletedUsers.length,
        usersReset: realIds.length,
      },
      "Demo cleanup: swept expired demo rows"
    );
  }

  return { deletedNotifications, deletedRequests, deletedPosts, deletedUsers, resetUserIds: realIds };
}

export function startDemoCleanupJob() {
  // Runs every 2 minutes — the returned task is stopped during graceful
  // shutdown so a restart can't interrupt one mid-run.
  return cron.schedule("*/2 * * * *", async () => {
    try {
      await runDemoCleanup();
    } catch (err) {
      logger.error({ err }, "Demo cleanup job failed");
      Sentry.captureException(err);
    }
  });
}
