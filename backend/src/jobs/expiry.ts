import cron from "node-cron";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";
import { eq, or, lt, and, inArray } from "drizzle-orm";
import { notifyPicker } from "../lib/mailer.js";
import { createNotification } from "../lib/notify.js";

export function startExpiryJob() {
  // Runs every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();

      const expired = await db
        .update(foodPosts)
        .set({ status: "expired" })
        .where(
          and(
            or(
              eq(foodPosts.status, "open"),
              eq(foodPosts.status, "pending_approval")
            ),
            lt(foodPosts.pickupWindowEnd, now)
          )
        )
        .returning({ id: foodPosts.id });

      if (expired.length > 0) {
        console.log(`[EXPIRY JOB] Marked ${expired.length} post(s) as expired`);

        // A post that expired while in pending_approval leaves its pending
        // pickup request stuck forever — reject it and tell the picker.
        const expiredPostIds = expired.map((p) => p.id);

        const orphanedRequests = await db
          .update(pickupRequests)
          .set({ status: "rejected" })
          .where(
            and(
              inArray(pickupRequests.postId, expiredPostIds),
              eq(pickupRequests.status, "pending")
            )
          )
          .returning({ id: pickupRequests.id, pickerId: pickupRequests.pickerId, postId: pickupRequests.postId });

        for (const req of orphanedRequests) {
          createNotification(
            req.pickerId,
            "The food post you requested expired before the poster responded.",
            req.postId,
            "request_rejected"
          ).catch(console.error);

          const [picker] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, req.pickerId))
            .limit(1);

          if (picker) {
            notifyPicker(picker.email, "request_rejected");
          }
        }
      }
    } catch (err) {
      console.error("[EXPIRY JOB] Failed to run expiry job:", err);
    }
  });
}
