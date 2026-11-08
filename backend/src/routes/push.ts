import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { userLimiter } from "../middleware/limiters.js";
import { parseJsonBody } from "../lib/http.js";
import { env } from "../env.js";
import { isPushServiceUrl, pushEnabled, removeSubscription, saveSubscription } from "../lib/notifications/push.js";

export const pushRoutes = new Hono();

pushRoutes.use("*", authMiddleware, userLimiter);

const endpoint = z
  .string()
  .max(2048, "Invalid push endpoint")
  .refine(isPushServiceUrl, "Invalid push endpoint");

const subscribeSchema = z.object({
  endpoint,
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().max(2048) });

// null when push isn't set up on this server: the app then doesn't offer it.
pushRoutes.get("/public-key", (c) => c.json({ publicKey: pushEnabled ? env.VAPID_PUBLIC_KEY : null }));

pushRoutes.post("/subscriptions", async (c) => {
  const { userId } = c.get("user");
  if (!pushEnabled) return c.json({ error: "Notifications aren't available right now" }, 409);

  const parsed = await parseJsonBody(c, subscribeSchema);
  if (!parsed.ok) return parsed.response;

  const { endpoint, keys } = parsed.data;
  await saveSubscription(userId, { endpoint, p256dh: keys.p256dh, auth: keys.auth });
  return c.json({ subscribed: true }, 201);
});

pushRoutes.post("/unsubscribe", async (c) => {
  const { userId } = c.get("user");
  const parsed = await parseJsonBody(c, unsubscribeSchema);
  if (!parsed.ok) return parsed.response;

  await removeSubscription(userId, parsed.data.endpoint);
  return c.json({ subscribed: false });
});
