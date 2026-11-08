import { db } from "../../db/index.js";
import { foodPosts, pickupRequests } from "../../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { ConflictError } from "../errors.js";

type CreateRequestInput = {
  postId: string;
  pickerId: string;
  pickerName: string;
  selfieUrl?: string;
  etaMinutes: number;
  isDemo?: boolean;
  demoExpiresAt?: Date;
};

// Atomically claims an open post and inserts the pickup request row — shared
// by the real create-request route and demo provisioning (lib/demo.ts),
// which calls this directly instead of re-entering HTTP with a fake session.
// Returns null if the post was no longer open (lost the claim race). One
// transaction, so a failed insert can't leave the post claimed with no
// request behind it.
export async function createRequestRow(input: CreateRequestInput) {
  return db.transaction(async (tx) => {
    const [claimedPost] = await tx
      .update(foodPosts)
      .set({ status: "pending_approval" })
      .where(and(eq(foodPosts.id, input.postId), eq(foodPosts.status, "open")))
      .returning({ id: foodPosts.id });

    if (!claimedPost) return null;

    const [request] = await tx
      .insert(pickupRequests)
      .values({
        postId: input.postId,
        pickerId: input.pickerId,
        pickerName: input.pickerName,
        selfieUrl: input.selfieUrl,
        etaMinutes: input.etaMinutes,
        isDemo: input.isDemo ?? false,
        demoExpiresAt: input.demoExpiresAt ?? null,
      })
      .returning();

    return request;
  });
}

// Approves a pending request and closes its post together in one
// transaction, guarded against concurrent double-processing — shared by the
// real approve route and lib/demo.ts's auto-approve flow, which calls this
// directly with no HTTP round trip. Returns false if the race was lost.
export async function approveRequestTx(requestId: string, postId: string): Promise<boolean> {
  return db
    .transaction(async (tx) => {
      const [claimedRequest] = await tx
        .update(pickupRequests)
        .set({ status: "approved", approvedAt: new Date() })
        .where(and(eq(pickupRequests.id, requestId), eq(pickupRequests.status, "pending")))
        .returning({ id: pickupRequests.id });

      if (!claimedRequest) throw new ConflictError();

      const [claimedPost] = await tx
        .update(foodPosts)
        .set({ status: "closed", approvedRequestId: requestId })
        .where(and(eq(foodPosts.id, postId), eq(foodPosts.status, "pending_approval")))
        .returning({ id: foodPosts.id });

      if (!claimedPost) throw new ConflictError();
    })
    .then(() => true)
    .catch((err) => {
      if (err instanceof ConflictError) return false;
      throw err;
    });
}

// Ends an approved pickup that won't happen and puts the food back: the
// poster says the picker never came ("missed"), or the picker says they
// can't make it ("withdrawn"). The post goes back in the feed, or ends if
// its pickup time has already passed; either way the picker loses the
// pickup spot at once, since that's only shown while the post is closed.
// Guarded like the other status changes: only one of this, the poster
// marking it collected, or the expiry job's auto-complete can win. Returns
// the post's new status, or null if the race was lost.
export async function releaseApprovedPickup(
  requestId: string,
  postId: string,
  outcome: "missed" | "withdrawn"
): Promise<"open" | "expired" | null> {
  return db
    .transaction(async (tx) => {
      const [claimedRequest] = await tx
        .update(pickupRequests)
        .set({ status: outcome })
        .where(and(eq(pickupRequests.id, requestId), eq(pickupRequests.status, "approved")))
        .returning({ id: pickupRequests.id });

      if (!claimedRequest) throw new ConflictError();

      const [releasedPost] = await tx
        .update(foodPosts)
        .set({
          status: sql`case when ${foodPosts.pickupWindowEnd} < now() then 'expired'::post_status else 'open'::post_status end`,
          approvedRequestId: null,
        })
        .where(
          and(
            eq(foodPosts.id, postId),
            eq(foodPosts.status, "closed"),
            eq(foodPosts.approvedRequestId, requestId)
          )
        )
        .returning({ status: foodPosts.status });

      if (!releasedPost) throw new ConflictError();
      return releasedPost.status as "open" | "expired";
    })
    .catch((err) => {
      if (err instanceof ConflictError) return null;
      throw err;
    });
}
