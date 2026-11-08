import { db } from "../../db/index.js";
import { notifications, notificationTypeEnum } from "../../db/schema.js";
import { publish } from "./notificationStream.js";
import { sendPush } from "./push.js";
import { logger } from "../logger.js";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export async function createNotification(
  userId: string,
  message: string,
  postId?: string,
  type?: NotificationType,
  demoExpiresAt?: Date
) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId,
      message,
      postId,
      type,
      isDemo: !!demoExpiresAt,
      demoExpiresAt: demoExpiresAt ?? null,
    })
    .returning({
      id: notifications.id,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
      postId: notifications.postId,
    });

  await publish(userId, row);

  // Demo notifications are about sample food: nothing to buzz a phone for.
  if (!demoExpiresAt) {
    sendPush(userId, { body: message, url: postId ? `/posts/${postId}` : "/feed" }).catch((err) =>
      logger.error({ err, userId }, "Sending push notification failed")
    );
  }
}