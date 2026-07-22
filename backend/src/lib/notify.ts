import { db } from "../db/index.js";
import { notifications, notificationTypeEnum } from "../db/schema.js";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

export async function createNotification(
  userId: string,
  message: string,
  postId?: string,
  type?: NotificationType
) {
  await db.insert(notifications).values({ userId, message, postId, type });
}