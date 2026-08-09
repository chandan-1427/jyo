import { db } from "../../db/index.js";
import { notifications, notificationTypeEnum } from "../../db/schema.js";
import { publish } from "./notificationStream.js";

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
}