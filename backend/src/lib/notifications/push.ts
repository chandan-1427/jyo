import { sendNotification, setVapidDetails } from "web-push";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { pushSubscriptions } from "../../db/schema.js";
import { env } from "../../env.js";
import { logger } from "../logger.js";

export const MAX_SUBSCRIPTIONS_PER_USER = 10;

export const pushEnabled = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);

if (pushEnabled) {
  setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

// The browser's push service gives each subscription a URL, and the server
// sends to whatever URL it was given. Only the real push services are
// accepted, so a made-up "subscription" can't point the server at an
// internal address or anywhere else.
const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export function isPushServiceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname;
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export async function saveSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, ...sub })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.p256dh, auth: sub.auth, createdAt: new Date() },
    });

  // Keep the newest few: an old phone nobody uses any more shouldn't keep
  // receiving someone's notifications forever.
  const keep = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.createdAt))
    .limit(MAX_SUBSCRIPTIONS_PER_USER);
  await db.delete(pushSubscriptions).where(
    and(
      eq(pushSubscriptions.userId, userId),
      notInArray(pushSubscriptions.id, keep.map((s) => s.id))
    )
  );
}

export async function removeSubscription(userId: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function removeAllSubscriptions(userId: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export type PushMessage = { body: string; url: string };

// Fire and forget, like the notification emails. The text shows on a lock
// screen, which in a shared household anyone may see, so it carries only the
// generic notification message: never a name, a number or a place.
export async function sendPush(userId: string, message: PushMessage) {
  if (!pushEnabled) return;

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  const gone: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: "Jyo", ...message }),
          // An hour: after that, the pickup it's about has likely moved on.
          { TTL: 60 * 60, urgency: "high" }
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // The browser unsubscribed or the subscription expired.
        if (status === 404 || status === 410) gone.push(sub.id);
        else logger.warn({ err, status, subscriptionId: sub.id }, "Push notification failed");
      }
    })
  );

  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
}
