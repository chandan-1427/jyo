import { db } from "../db/index.js";
import { foodPosts, pickupRequests } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { ConflictError } from "./errors.js";

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
// Returns null if the post was no longer open (lost the claim race).
export async function createRequestRow(input: CreateRequestInput) {
  const [claimedPost] = await db
    .update(foodPosts)
    .set({ status: "pending_approval" })
    .where(and(eq(foodPosts.id, input.postId), eq(foodPosts.status, "open")))
    .returning({ id: foodPosts.id });

  if (!claimedPost) return null;

  const [request] = await db
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
        .set({ status: "approved" })
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
