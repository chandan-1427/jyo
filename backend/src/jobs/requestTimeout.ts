import cron from "node-cron";
import * as Sentry from "@sentry/node";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests } from "../db/schema.js";
import { notifyPicker } from "../lib/mailer.js";
import { createNotification } from "../lib/notifications/notify.js";
import { broadcastFeedChange } from "../lib/notifications/notificationStream.js";
import { findUserEmail } from "../lib/domain/finders.js";
import { isSyntheticEmail } from "../lib/domain/demo.js";
import { logger } from "../lib/logger.js";
import { REQUEST_TIMEOUT_MS } from "../lib/domain/requestActions.js";

// A waiting request holds the post: nobody else can ask for it. Without a
// limit, a poster who is busy or asleep kept the food locked until the
// pickup time ran out. After REQUEST_TIMEOUT_MS the request closes and the
// food goes back in the feed. Both updates are one transaction, guarded on
// status, so an approve or cancel landing at the same moment wins or loses
// cleanly.
export async function runRequestTimeout(now = new Date()) {
  const timedOut = await db.transaction(async (tx) => {
    const requests = await tx
      .update(pickupRequests)
      .set({ status: "timed_out" })
      .where(
        and(
          eq(pickupRequests.status, "pending"),
          lt(pickupRequests.createdAt, new Date(now.getTime() - REQUEST_TIMEOUT_MS))
        )
      )
      .returning({
        id: pickupRequests.id,
        postId: pickupRequests.postId,
        pickerId: pickupRequests.pickerId,
        isDemo: pickupRequests.isDemo,
        demoExpiresAt: pickupRequests.demoExpiresAt,
      });
    if (requests.length === 0) return [];

    const posts = await tx
      .update(foodPosts)
      .set({
        status: sql`case when ${lt(foodPosts.pickupWindowEnd, now)} then 'expired'::post_status else 'open'::post_status end`,
      })
      .where(and(inArray(foodPosts.id, requests.map((r) => r.postId)), eq(foodPosts.status, "pending_approval")))
      .returning({ id: foodPosts.id, posterId: foodPosts.posterId, status: foodPosts.status });

    return requests.map((r) => ({ ...r, post: posts.find((p) => p.id === r.postId) }));
  });

  if (timedOut.length === 0) return timedOut;
  logger.info({ count: timedOut.length, requestIds: timedOut.map((r) => r.id) }, "Timed out unanswered requests");

  for (const req of timedOut) {
    const demoExpiresAt = req.isDemo ? req.demoExpiresAt ?? undefined : undefined;
    const onError = (err: unknown) =>
      logger.error({ err, pickupRequestId: req.id }, "Failed to create request_timed_out notification");

    createNotification(
      req.pickerId,
      "The person sharing didn't answer in time, so your request closed. Other food nearby is in the feed.",
      req.postId,
      "request_timed_out",
      demoExpiresAt
    ).catch(onError);

    // The poster already had an email about the request; this one is in-app only.
    if (req.post) {
      createNotification(
        req.post.posterId,
        req.post.status === "open"
          ? "A request waited 15 minutes without an answer, so your food is back in the feed."
          : "A request waited without an answer until the pickup time ended.",
        req.postId,
        "request_timed_out",
        demoExpiresAt
      ).catch(onError);
    }

    const email = await findUserEmail(req.pickerId);
    if (email && !isSyntheticEmail(email)) notifyPicker(email, "request_timed_out");
  }

  if (timedOut.some((r) => !r.isDemo && r.post?.status === "open")) broadcastFeedChange();
  return timedOut;
}

export function startRequestTimeoutJob() {
  // Every minute, so a request closes within a minute of its 15.
  return cron.schedule("* * * * *", async () => {
    try {
      await runRequestTimeout();
    } catch (err) {
      logger.error({ err }, "Request timeout job failed");
      Sentry.captureException(err);
    }
  });
}
