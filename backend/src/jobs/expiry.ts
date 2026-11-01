import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";
import { eq, or, lt, and, inArray } from "drizzle-orm";
import { notifyPicker } from "../lib/mailer.js";
import { createNotification } from "../lib/notifications/notify.js";
import { broadcastFeedChange } from "../lib/notifications/notificationStream.js";
import { isSyntheticEmail } from "../lib/domain/demo.js";
import { logger } from "../lib/logger.js";

// Ends posts whose pickup window has passed while nobody had been approved
// (open or waiting for an answer), and declines the request left waiting on
// them, telling its picker. An approved post (closed) is left alone: the
// pickup was agreed, and the poster marks it collected.
//
// Both updates are one transaction. Run separately, a restart between them
// left the post expired and its request "waiting" for good, since the next
// run only looks at posts that are still open or waiting. Exported apart from
// the schedule so tests can run it.
export async function runExpiry(now = new Date()) {
  const { expired, declined } = await db.transaction(async (tx) => {
    const expired = await tx
      .update(foodPosts)
      .set({ status: "expired" })
      .where(
        and(
          or(eq(foodPosts.status, "open"), eq(foodPosts.status, "pending_approval")),
          lt(foodPosts.pickupWindowEnd, now)
        )
      )
      .returning({ id: foodPosts.id, isDemo: foodPosts.isDemo });

    if (expired.length === 0) return { expired, declined: [] };

    const declined = await tx
      .update(pickupRequests)
      .set({ status: "rejected" })
      .where(
        and(
          inArray(pickupRequests.postId, expired.map((p) => p.id)),
          eq(pickupRequests.status, "pending")
        )
      )
      .returning({
        id: pickupRequests.id,
        pickerId: pickupRequests.pickerId,
        postId: pickupRequests.postId,
        isDemo: pickupRequests.isDemo,
        demoExpiresAt: pickupRequests.demoExpiresAt,
      });

    return { expired, declined };
  });

  if (expired.length === 0) return { expired, declined };

  logger.info({ count: expired.length, postIds: expired.map((p) => p.id) }, "Marked posts as expired");
  if (expired.some((p) => !p.isDemo)) broadcastFeedChange();

  for (const req of declined) {
    const demoExpiresAt = req.isDemo ? req.demoExpiresAt ?? undefined : undefined;

    createNotification(
      req.pickerId,
      "The food post you requested expired before the poster responded.",
      req.postId,
      "request_rejected",
      demoExpiresAt
    ).catch((err) => logger.error({ err, pickupRequestId: req.id }, "Failed to create expiry notification"));

    const [picker] = await db.select({ email: users.email }).from(users).where(eq(users.id, req.pickerId)).limit(1);

    if (picker && !isSyntheticEmail(picker.email)) {
      notifyPicker(picker.email, "request_rejected");
    }
  }

  return { expired, declined };
}

export function startExpiryJob() {
  // Runs every 5 minutes — the returned task is stopped during graceful
  // shutdown so a restart can't interrupt one mid-run.
  return cron.schedule("*/5 * * * *", async () => {
    try {
      await runExpiry();
    } catch (err) {
      logger.error({ err }, "Expiry job failed");
      Sentry.captureException(err);
    }
  });
}
