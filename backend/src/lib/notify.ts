import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";

export async function createNotification(userId: string, message: string) {
  await db.insert(notifications).values({ userId, message });
}