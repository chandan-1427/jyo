import { Hono } from "hono";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

export const notificationRoutes = new Hono();

notificationRoutes.use("*", authMiddleware);

// Get all notifications for current user
notificationRoutes.get("/", async (c) => {
  const { userId } = c.get("user");

  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  return c.json({ notifications: items });
});

// Mark all as read
notificationRoutes.put("/read-all", async (c) => {
  const { userId } = c.get("user");

  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId));

  return c.json({ message: "All notifications marked as read" });
});