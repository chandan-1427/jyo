import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { subscribe, unsubscribe } from "../lib/notifications/notificationStream.js";
import { isValidUuid } from "../lib/domain/finders.js";

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
      if (stream.closed) return;
      // The client can disconnect between the closed-check above and this
      // write actually going out — that's a routine disconnect, not a bug,
      // so it must not surface as an unhandled rejection (index.ts's
      // handler would report it to Sentry as fatal).
      stream.writeSSE({ event: "ping", data: "" }).catch(() => {});
    }, HEARTBEAT_MS);

    await new Promise<void>((resolve) => stream.onAbort(resolve));

    clearInterval(heartbeat);
    unsubscribe(userId, stream);
  });
});

// Get all notifications for current user
notificationRoutes.get("/", async (c) => {
  const { userId, isDemo } = c.get("user");

  const items = await db
    .select({
      id: notifications.id,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
      postId: notifications.postId,
    })
    .from(notifications)
    // Outside demo mode, notifications from a demo stay hidden.
    .where(and(eq(notifications.userId, userId), isDemo ? undefined : eq(notifications.isDemo, false)))
    .orderBy(desc(notifications.createdAt))
    .limit(20);

  return c.json({ notifications: items });
});

// Mark one as read, when it's opened. Matching on userId as well as id means
// one user can't mark another's; either way it's a plain 404.
notificationRoutes.put("/:id/read", async (c) => {
  const { userId } = c.get("user");
  const notificationId = c.req.param("id");

  if (!isValidUuid(notificationId)) {
    return c.json({ error: "Notification not found" }, 404);
  }

  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });

  if (!updated) {
    return c.json({ error: "Notification not found" }, 404);
  }

  return c.json({ message: "Notification marked as read" });
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