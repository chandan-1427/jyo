import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { subscribe, unsubscribe } from "../lib/notifications/notificationStream.js";

export const notificationRoutes = new Hono();

notificationRoutes.use("*", authMiddleware);

const HEARTBEAT_MS = 20_000;

// Authenticated push channel for new notifications, replacing the old
// Supabase Realtime subscription (which relied on a client-side anon key
// that, without RLS, could read every user's notifications — see
// backend/drizzle/0009_enable_rls.sql). Auth here reuses the same cookie
// middleware as every other route, so no separate credential is needed.
notificationRoutes.get("/stream", (c) => {
  const { userId } = c.get("user");

  return streamSSE(c, async (stream) => {
    subscribe(userId, stream);

    const heartbeat = setInterval(() => {
      if (!stream.closed) stream.writeSSE({ event: "ping", data: "" });
    }, HEARTBEAT_MS);

    await new Promise<void>((resolve) => stream.onAbort(resolve));

    clearInterval(heartbeat);
    unsubscribe(userId, stream);
  });
});

// Get all notifications for current user
notificationRoutes.get("/", async (c) => {
  const { userId } = c.get("user");

  const items = await db
    .select({
      id: notifications.id,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
      postId: notifications.postId,
    })
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