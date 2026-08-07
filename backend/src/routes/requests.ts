import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { haversineDistance } from "../lib/haversine.js";
import { notifyPoster, notifyPicker } from "../lib/mailer.js";
import { uploadFile, MAX_UPLOAD_REQUEST_BYTES } from "../lib/storage.js";
import { createRequestLimiter, uploadLimiter } from "../middleware/limiters.js";
import { z } from "zod";
import { createNotification } from "../lib/notify.js";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { ConflictError } from "../lib/errors.js";
import { isValidUuid, findPostById, findRequestById, findUserEmail } from "../lib/finders.js";
import { createRequestRow, approveRequestTx } from "../lib/requestActions.js";
import { isSyntheticEmail, autoApproveIfDemo } from "../lib/demo.js";

export const requestRoutes = new Hono();

requestRoutes.use("*", authMiddleware);

const createRequestSchema = z.object({
  postId: z.uuid("Invalid post ID"),
  pickerName: z.string().min(2, "Name must be at least 2 characters").max(100),
  selfieUrl: z.url("Invalid selfie URL").optional(),
  etaMinutes: z.number().int().min(1).max(180, "ETA cannot exceed 3 hours"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// --- Submit pickup request ---
requestRoutes.post("/", createRequestLimiter, async (c) => {
  const { userId, isDemo } = c.get("user");
  const body = await c.req.json();
  const result = createRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { postId, pickerName, selfieUrl, etaMinutes, lat, lng } = result.data;

  const post = await findPostById(postId);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.posterId === userId) {
    return c.json({ error: "You cannot request your own food post" }, 400);
  }

  if (post.status !== "open") {
    return c.json({ error: "This post is no longer available for requests" }, 400);
  }

  const distance = haversineDistance(lat, lng, post.pickupLat, post.pickupLng);
  if (env.APP_ENV === "production" && !isDemo && distance > 20) {
    return c.json({ error: "You are too far from this post to request it" }, 400);
  }

  // Atomically claim the post — the status condition in the WHERE clause
  // prevents two concurrent requests from both passing the check above and
  // creating duplicate pending requests for the same post. Stamped with the
  // post's own demo flag/expiry so a request against a demo post is swept
  // up by the cleanup cron too — otherwise it has no demoExpiresAt and
  // lingers forever.
  const demoExpiresAt = post.isDemo ? post.demoExpiresAt ?? undefined : undefined;
  const request = await createRequestRow({
    postId,
    pickerId: userId,
    pickerName,
    selfieUrl,
    etaMinutes,
    isDemo: post.isDemo,
    demoExpiresAt,
  });

  if (!request) {
    return c.json({ error: "This post is no longer available for requests" }, 400);
  }

  const posterEmail = await findUserEmail(post.posterId);

  createNotification(
    post.posterId,
    "Someone wants to pick up your food. Review their request.",
    postId,
    "request_received",
    demoExpiresAt
  ).catch((err) => logger.error({ err, postId, pickupRequestId: request.id }, "Failed to create request_received notification"));

  if (posterEmail && !isSyntheticEmail(posterEmail)) notifyPoster(posterEmail, "request_received");

  // The seeded demo post's "poster" is synthetic with no one to review the
  // request — auto-approve instantly instead of leaving the visitor
  // waiting on a review that will never come.
  if (post.isDemo) {
    const approved = await autoApproveIfDemo(request.id, postId);
    if (approved) {
      createNotification(
        userId,
        "Your pickup request was approved. Check the post for the location.",
        postId,
        "request_approved",
        demoExpiresAt
      ).catch((err) => logger.error({ err, postId, pickupRequestId: request.id }, "Failed to create demo request_approved notification"));
    }
  }

  return c.json({ message: "Request submitted", request }, 201);
});

// --- Approve request ---
requestRoutes.put("/:id/approve", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  if (!isValidUuid(requestId)) {
    return c.json({ error: "Invalid request ID" }, 400);
  }

  const request = await findRequestById(requestId);

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  const post = await findPostById(request.postId);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "pending_approval") {
    return c.json({ error: "This post is not awaiting approval" }, 400);
  }

  // Two concurrent approve calls (e.g. a double-click) could both pass the
  // status check above before either write commits. approveRequestTx's
  // conditional WHERE clauses make each UPDATE a no-op if the row's status
  // already moved out from under it, and the transaction ensures the
  // request and post flip together — never one without the other.
  const approved = await approveRequestTx(requestId, request.postId);

  if (!approved) {
    return c.json({ error: "This request has already been processed" }, 400);
  }

  const pickerEmail = await findUserEmail(request.pickerId);
  const demoExpiresAt = request.isDemo ? request.demoExpiresAt ?? undefined : undefined;

  createNotification(
    request.pickerId,
    "Your pickup request was approved. Check the post for the location.",
    request.postId,
    "request_approved",
    demoExpiresAt
  ).catch((err) => logger.error({ err, pickupRequestId: requestId }, "Failed to create request_approved notification"));

  if (pickerEmail && !isSyntheticEmail(pickerEmail)) notifyPicker(pickerEmail, "request_approved");
  // duplicate `await notifyPicker(...)` call removed — was sending this
  // email twice on every approval

  return c.json({ message: "Request approved" });
});

// --- Reject request ---
requestRoutes.put("/:id/reject", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  if (!isValidUuid(requestId)) {
    return c.json({ error: "Invalid request ID" }, 400);
  }

  const request = await findRequestById(requestId);

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  const post = await findPostById(request.postId);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "pending_approval") {
    return c.json({ error: "This post is not awaiting approval" }, 400);
  }

  const rejected = await db
    .transaction(async (tx) => {
      const [claimedRequest] = await tx
        .update(pickupRequests)
        .set({ status: "rejected" })
        .where(and(eq(pickupRequests.id, requestId), eq(pickupRequests.status, "pending")))
        .returning({ id: pickupRequests.id });

      if (!claimedRequest) throw new ConflictError();

      const [claimedPost] = await tx
        .update(foodPosts)
        .set({ status: "open" })
        .where(and(eq(foodPosts.id, request.postId), eq(foodPosts.status, "pending_approval")))
        .returning({ id: foodPosts.id });

      if (!claimedPost) throw new ConflictError();
    })
    .then(() => true)
    .catch((err) => {
      if (err instanceof ConflictError) return false;
      throw err;
    });

  if (!rejected) {
    return c.json({ error: "This request has already been processed" }, 400);
  }

  const pickerEmail = await findUserEmail(request.pickerId);
  const demoExpiresAt = request.isDemo ? request.demoExpiresAt ?? undefined : undefined;

  createNotification(
    request.pickerId,
    "Your pickup request was rejected.",
    request.postId,
    "request_rejected",
    demoExpiresAt
  ).catch((err) => logger.error({ err, pickupRequestId: requestId }, "Failed to create request_rejected notification"));

  if (pickerEmail && !isSyntheticEmail(pickerEmail)) notifyPicker(pickerEmail, "request_rejected");
  // duplicate call removed here too

  return c.json({ message: "Request rejected" });
});

// --- Cancel request ---
requestRoutes.put("/:id/cancel", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  if (!isValidUuid(requestId)) {
    return c.json({ error: "Invalid request ID" }, 400);
  }

  const request = await findRequestById(requestId);

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  if (request.pickerId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (request.status !== "pending") {
    return c.json({ error: "Cannot cancel a request that has already been approved" }, 400);
  }

  const cancelled = await db
    .transaction(async (tx) => {
      const [claimedRequest] = await tx
        .update(pickupRequests)
        .set({ status: "cancelled" })
        .where(and(eq(pickupRequests.id, requestId), eq(pickupRequests.status, "pending")))
        .returning({ id: pickupRequests.id });

      if (!claimedRequest) throw new ConflictError();

      const [claimedPost] = await tx
        .update(foodPosts)
        .set({ status: "open" })
        .where(and(eq(foodPosts.id, request.postId), eq(foodPosts.status, "pending_approval")))
        .returning({ id: foodPosts.id });

      if (!claimedPost) throw new ConflictError();
    })
    .then(() => true)
    .catch((err) => {
      if (err instanceof ConflictError) return false;
      throw err;
    });

  if (!cancelled) {
    return c.json({ error: "This request has already been processed" }, 400);
  }

  const post = await findPostById(request.postId);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  const posterEmail = await findUserEmail(post.posterId);
  const demoExpiresAt = request.isDemo ? request.demoExpiresAt ?? undefined : undefined;

  createNotification(
    post.posterId,
    "A picker cancelled their request. Your post is open again.",
    request.postId,
    "request_cancelled",
    demoExpiresAt
  ).catch((err) => logger.error({ err, pickupRequestId: requestId }, "Failed to create request_cancelled notification"));

  if (posterEmail && !isSyntheticEmail(posterEmail)) notifyPoster(posterEmail, "request_cancelled");
  // duplicate call removed here too

  return c.json({ message: "Request cancelled" });
});

requestRoutes.get("/mine", async (c) => {
  const { userId } = c.get("user");

  const requests = await db
    .select({
      id: pickupRequests.id,
      postId: pickupRequests.postId,
      postTitle: foodPosts.title,
      pickerName: pickupRequests.pickerName,
      etaMinutes: pickupRequests.etaMinutes,
      status: pickupRequests.status,
      isDemo: pickupRequests.isDemo,
      createdAt: pickupRequests.createdAt,
    })
    .from(pickupRequests)
    .innerJoin(foodPosts, eq(pickupRequests.postId, foodPosts.id))
    .where(eq(pickupRequests.pickerId, userId))
    .orderBy(desc(pickupRequests.createdAt));

  return c.json({ requests });
});

requestRoutes.post(
  "/upload-selfie",
  uploadLimiter,
  bodyLimit({
    maxSize: MAX_UPLOAD_REQUEST_BYTES,
    onError: (c) => c.json({ error: "File is too large. Maximum size is 5MB." }, 413),
  }),
  async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json({ error: "No file provided" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const url = await uploadFile(buffer, "selfies");
      return c.json({ url });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Upload failed" }, 400);
    }
  }
);