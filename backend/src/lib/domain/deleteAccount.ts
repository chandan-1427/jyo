import { eq, inArray, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { foodPosts, notifications, pickupRequests, users } from "../../db/schema.js";
import { ConflictError } from "../errors.js";

export const PICKUP_IN_PROGRESS =
  "You have a pickup in progress. Answer or cancel waiting requests and finish approved pickups first (My posts and My requests), then delete your account.";

// Removes an account and everything that belongs to it, in one transaction:
// its posts (and the demo posts seeded for it) with every request on them,
// its requests on other people's posts, its notifications, and the account.
// Other people's notifications about its posts stay, with the link to the
// post cleared by the foreign key.
//
// Refused while a real pickup is under way, on either side: someone may be on
// their way, and deleting would leave them with nothing to go on.
//
// The account's posts and requests are locked first, so a request or an
// approval arriving at the same moment waits, then finds them gone, rather
// than being half-deleted with them.
//
// Returns the stored files to remove once it has committed (storage isn't
// part of the transaction; the nightly orphaned-upload sweep catches any
// removal that fails).
export async function deleteAccount(userId: string) {
  return db
    .transaction(async (tx) => {
      const posts = await tx
        .select({ id: foodPosts.id, status: foodPosts.status, isDemo: foodPosts.isDemo, photoUrl: foodPosts.photoUrl })
        .from(foodPosts)
        .where(or(eq(foodPosts.posterId, userId), eq(foodPosts.seededForUserId, userId)))
        .for("update");

      const asked = await tx
        .select({ status: pickupRequests.status, isDemo: pickupRequests.isDemo, postStatus: foodPosts.status })
        .from(pickupRequests)
        .innerJoin(foodPosts, eq(pickupRequests.postId, foodPosts.id))
        .where(eq(pickupRequests.pickerId, userId))
        .for("update");

      const sharingNow = posts.some((p) => !p.isDemo && (p.status === "pending_approval" || p.status === "closed"));
      const pickingUpNow = asked.some(
        (r) => !r.isDemo && (r.status === "pending" || (r.status === "approved" && r.postStatus === "closed"))
      );
      if (sharingNow || pickingUpNow) throw new ConflictError();

      const postIds = posts.map((p) => p.id);

      const requests = await tx
        .delete(pickupRequests)
        .where(or(eq(pickupRequests.pickerId, userId), postIds.length ? inArray(pickupRequests.postId, postIds) : undefined))
        .returning({ id: pickupRequests.id, selfieUrl: pickupRequests.selfieUrl });

      // Someone else's collected post whose approved request was this person's.
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
        status: "deleted" as const,
        avatarUrl: account?.avatarUrl ?? null,
        photoUrls: posts.flatMap((p) => (p.photoUrl ? [p.photoUrl] : [])),
        selfieUrls: requests.flatMap((r) => (r.selfieUrl ? [r.selfieUrl] : [])),
        // A real post left everyone's feed.
        feedChanged: posts.some((p) => !p.isDemo && p.status === "open"),
      };
    })
    .catch((err) => {
      if (err instanceof ConflictError) return { status: "pickup_in_progress" as const };
      throw err;
    });
}
