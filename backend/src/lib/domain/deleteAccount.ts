import { eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { foodPosts, notifications, pickupRequests, users } from "../../db/schema.js";
import { ConflictError } from "../errors.js";

export const PICKUP_IN_PROGRESS =
  "You have a pickup in progress. Answer or cancel waiting requests and finish approved pickups first (My posts and My requests), then delete your account.";

// How long a deleted account is kept, hidden, before it's erased for good.
export const DELETED_ACCOUNT_RETENTION_DAYS = 30;

// Deleting an account is in two steps.
//
// 1. Now (deleteAccount): the account is marked deleted and kept, hidden from
//    everyone. It can't log in, every session ends, its posts vanish from the
//    feed, their pages and everyone's history (posterNotDeleted), and its
//    email is free for a new sign-up, which starts a fresh account. Its photos
//    (profile, posts, selfies) are deleted from storage at once: faces and
//    pictures of someone's home are the most sensitive part, and nothing needs
//    them kept. Refused while a real pickup is waiting or approved on either
//    side, since someone may be on their way.
//
// 2. After DELETED_ACCOUNT_RETENTION_DAYS (purgeAccount, from the nightly
//    jobs/deletedAccountPurge.ts): everything is erased for good.

// Step 1. The account's posts and requests are locked first, so a request or
// an approval arriving at the same moment waits, then finds the account gone.
// Returns the files to remove once it has committed (storage isn't part of
// the transaction; the nightly orphaned-upload sweep catches any that fail).
export async function deleteAccount(userId: string) {
  return db
    .transaction(async (tx) => {
      const posts = await tx
        .select({ id: foodPosts.id, status: foodPosts.status, isDemo: foodPosts.isDemo, photoUrl: foodPosts.photoUrl })
        .from(foodPosts)
        .where(or(eq(foodPosts.posterId, userId), eq(foodPosts.seededForUserId, userId)))
        .for("update");

      const asked = await tx
        .select({
          id: pickupRequests.id,
          status: pickupRequests.status,
          isDemo: pickupRequests.isDemo,
          selfieUrl: pickupRequests.selfieUrl,
          postStatus: foodPosts.status,
        })
        .from(pickupRequests)
        .innerJoin(foodPosts, eq(pickupRequests.postId, foodPosts.id))
        .where(eq(pickupRequests.pickerId, userId))
        .for("update");

      const sharingNow = posts.some((p) => !p.isDemo && (p.status === "pending_approval" || p.status === "closed"));
      const pickingUpNow = asked.some(
        (r) => !r.isDemo && (r.status === "pending" || (r.status === "approved" && r.postStatus === "closed"))
      );
      if (sharingNow || pickingUpNow) throw new ConflictError();

      const [account] = await tx
        .select({ avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      if (!account) throw new ConflictError();

      // The account stays, hidden: the links it can't use any more are
      // cleared, and the token version bumped so no session survives.
      await tx
        .update(users)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          avatarUrl: null,
          verificationToken: null,
          verificationTokenExpiry: null,
          resetToken: null,
          resetTokenExpiry: null,
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(eq(users.id, userId));

      // Its photos go now; the rows only point at them.
      const postIds = posts.map((p) => p.id);
      if (postIds.length) await tx.update(foodPosts).set({ photoUrl: null }).where(inArray(foodPosts.id, postIds));

      // Its open posts are hidden already; ending them as well is what stops
      // a request waiting on the lock above. That request re-checks the post's
      // own status once this commits ("open" no more), whereas a check on the
      // account in another table isn't reliably seen by it.
      const openIds = posts.filter((p) => p.status === "open").map((p) => p.id);
      if (openIds.length) await tx.update(foodPosts).set({ status: "expired" }).where(inArray(foodPosts.id, openIds));
      await tx.update(pickupRequests).set({ selfieUrl: null }).where(eq(pickupRequests.pickerId, userId));

      return {
        status: "deleted" as const,
        avatarUrl: account.avatarUrl,
        photoUrls: posts.flatMap((p) => (p.photoUrl ? [p.photoUrl] : [])),
        selfieUrls: asked.flatMap((r) => (r.selfieUrl ? [r.selfieUrl] : [])),
        // A real post left everyone's feed.
        feedChanged: posts.some((p) => !p.isDemo && p.status === "open"),
      };
    })
    .catch((err) => {
      if (err instanceof ConflictError) return { status: "pickup_in_progress" as const };
      throw err;
    });
}

// Step 2: erases a deleted account and everything that belongs to it, in one
// transaction: its posts (and demo posts seeded for it) with every request on
// them, its requests on other people's posts, its notifications, and the
// account. Other people's notifications about its posts stay, with the link
// cleared by the foreign key; a collected post of someone else's that pointed
// at one of its requests has the pointer cleared. Returns the files still
// referenced (other people's selfies on its posts) for the caller to remove.
export async function purgeAccount(userId: string) {
  return db.transaction(async (tx) => {
    const posts = await tx
      .select({ id: foodPosts.id, photoUrl: foodPosts.photoUrl })
      .from(foodPosts)
      .where(or(eq(foodPosts.posterId, userId), eq(foodPosts.seededForUserId, userId)))
      .for("update");
    const postIds = posts.map((p) => p.id);

    const requests = await tx
      .delete(pickupRequests)
      .where(or(eq(pickupRequests.pickerId, userId), postIds.length ? inArray(pickupRequests.postId, postIds) : undefined))
      .returning({ id: pickupRequests.id, selfieUrl: pickupRequests.selfieUrl });

    if (requests.length) {
      await tx
        .update(foodPosts)
        .set({ approvedRequestId: null })
        .where(inArray(foodPosts.approvedRequestId, requests.map((r) => r.id)));
    }

    await tx.delete(notifications).where(eq(notifications.userId, userId));
    if (postIds.length) await tx.delete(foodPosts).where(inArray(foodPosts.id, postIds));
    const [account] = await tx.delete(users).where(eq(users.id, userId)).returning({ avatarUrl: users.avatarUrl });

    return {
      avatarUrl: account?.avatarUrl ?? null,
      photoUrls: posts.flatMap((p) => (p.photoUrl ? [p.photoUrl] : [])),
      selfieUrls: requests.flatMap((r) => (r.selfieUrl ? [r.selfieUrl] : [])),
    };
  });
}
