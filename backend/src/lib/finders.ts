import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";

export function isValidUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

export async function findPostById(postId: string) {
  const [post] = await db.select().from(foodPosts).where(eq(foodPosts.id, postId)).limit(1);
  return post ?? null;
}

export async function findRequestById(requestId: string) {
  const [request] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, requestId)).limit(1);
  return request ?? null;
}

export async function findUserEmail(userId: string): Promise<string | null> {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.email ?? null;
}
