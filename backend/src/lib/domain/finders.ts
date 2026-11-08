import { z } from "zod";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { foodPosts, pickupRequests, users } from "../../db/schema.js";

export function isValidUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

// A deleted account's posts are kept for 30 days but shown to nobody: as if
// they weren't there, in the feed, on their page, in anyone's history, and
// to every action on them. Used wherever posts are listed or looked up.
export const posterNotDeleted = sql<boolean>`not exists (select 1 from ${users} where ${users.id} = ${foodPosts.posterId} and ${users.isDeleted})`;

export async function findPostById(postId: string) {
  const [post] = await db.select().from(foodPosts).where(and(eq(foodPosts.id, postId), posterNotDeleted)).limit(1);
  return post ?? null;
}

export async function findRequestById(requestId: string) {
  const [request] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, requestId)).limit(1);
  return request ?? null;
}

export async function findPostByClientKey(posterId: string, clientKey: string) {
  const [post] = await db
    .select()
    .from(foodPosts)
    .where(and(eq(foodPosts.posterId, posterId), eq(foodPosts.clientKey, clientKey)))
    .limit(1);
  return post ?? null;
}

// This picker's request still holding the post (waiting or approved), if any.
export async function findOwnActiveRequest(postId: string, pickerId: string) {
  const [request] = await db
    .select()
    .from(pickupRequests)
    .where(
      and(
        eq(pickupRequests.postId, postId),
        eq(pickupRequests.pickerId, pickerId),
        inArray(pickupRequests.status, ["pending", "approved"])
      )
    )
    .orderBy(desc(pickupRequests.createdAt))
    .limit(1);
  return request ?? null;
}

// Whether this picker cancelled a request of their own for the post since
// `since`.
export async function hasCancelledRequestSince(postId: string, pickerId: string, since: Date) {
  const [row] = await db
    .select({ id: pickupRequests.id })
    .from(pickupRequests)
    .where(
      and(
        eq(pickupRequests.postId, postId),
        eq(pickupRequests.pickerId, pickerId),
        eq(pickupRequests.status, "cancelled"),
        gt(pickupRequests.createdAt, since)
      )
    )
    .limit(1);
  return !!row;
}

// Whether the poster marked this picker as not turning up for the post.
export async function hasMissedPickup(postId: string, pickerId: string) {
  const [row] = await db
    .select({ id: pickupRequests.id })
    .from(pickupRequests)
    .where(
      and(
        eq(pickupRequests.postId, postId),
        eq(pickupRequests.pickerId, pickerId),
        eq(pickupRequests.status, "missed")
      )
    )
    .limit(1);
  return !!row;
}

// Whether an approved pickup of this post was ever called off, by either
// side: how a repeated "reopen" tells it already happened.
export async function hasReleasedPickup(postId: string) {
  const [row] = await db
    .select({ id: pickupRequests.id })
    .from(pickupRequests)
    .where(and(eq(pickupRequests.postId, postId), inArray(pickupRequests.status, ["missed", "withdrawn"])))
    .limit(1);
  return !!row;
}

export async function findUserEmail(userId: string): Promise<string | null> {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.email ?? null;
}

// Case-insensitive: emails are lowercased on the way in now, but accounts
// created before the frontend started lowercasing them can still be stored
// with capitals. An exact match locked those users out once logins began
// arriving lowercased.
export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    // A deleted account's email belongs to nobody: signing up with it makes
    // a new account, and logging in with it finds none.
    .where(and(sql`lower(${users.email}) = lower(${email})`, eq(users.isDeleted, false)))
    .limit(1);
  return user ?? null;
}
