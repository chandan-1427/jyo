import cron from "node-cron";
import { db } from "../db/index.js";
import { foodPosts } from "../db/schema.js";
import { eq, or, lt, and } from "drizzle-orm";

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
      }
    } catch (err) {
      console.error("[EXPIRY JOB] Failed to run expiry job:", err);
    }
  });
}