import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { haversineDistance } from "../lib/geo/haversine.js";
import { notifyPoster, notifyPicker } from "../lib/mailer.js";
import { isOwnUploadUrl, FOREIGN_UPLOAD_MESSAGE, MAX_UPLOAD_REQUEST_BYTES } from "../lib/storage.js";
import { createRequestLimiter, uploadLimiter } from "../middleware/limiters.js";
import { createNotification } from "../lib/notifications/notify.js";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { ConflictError } from "../lib/errors.js";
import { isValidUuid, findPostById, findRequestById, findUserEmail } from "../lib/domain/finders.js";
import { createRequestRow, approveRequestTx } from "../lib/domain/requestActions.js";
import { isSyntheticEmail, autoApproveIfDemo } from "../lib/domain/demo.js";
import { createRequestSchema } from "../lib/validation.js";
import { broadcastFeedChange } from "../lib/notifications/notificationStream.js";
import { parseJsonBody, uploadFromForm } from "../lib/http.js";

export const requestRoutes = new Hono();

requestRoutes.use("*", authMiddleware);

// Someone else claimed the post first, or it closed: the request itself was
// fine, it just conflicts with where the post is now (409).
const NO_LONGER_AVAILABLE = "This post is no longer available for requests";
const ALREADY_PROCESSED = "This request has already been processed";

// What the request already became, for cancelling one that's no longer
// waiting.
const ALREADY: Record<string, string> = {
  approved: "This request has already been approved",
  rejected: "This request was already declined",
  cancelled: "This request was already cancelled",
};

// --- Submit pickup request ---
requestRoutes.post("/", createRequestLimiter, async (c) => {
  const { userId, isDemo } = c.get("user");
  const parsed = await parseJsonBody(c, createRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { postId, pickerName, selfieUrl, etaMinutes, lat, lng } = parsed.data;

  // Only our own uploads: see isOwnUploadUrl for why.
  if (selfieUrl && !isOwnUploadUrl(selfieUrl, "selfies")) {
    return c.json({ error: "Invalid input", details: { selfieUrl: [FOREIGN_UPLOAD_MESSAGE] } }, 400);
  }

  const post = await findPostById(postId);

  // Demo posts are seeded for one specific visitor's session and
  // auto-approve unconditionally below — anyone else requesting one would
  // get a fake "approved" post for food that doesn't exist. To anyone else
  // it's as if it isn't there.
  if (!post || (post.isDemo && post.seededForUserId !== userId)) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.posterId === userId) {
    return c.json({ error: "You cannot request your own food post" }, 403);
  }

  if (post.status !== "open") {
    return c.json({ error: NO_LONGER_AVAILABLE }, 409);
  }

  const distance = haversineDistance(lat, lng, post.pickupLat, post.pickupLng);
  if (env.APP_ENV === "production" && !isDemo && distance > 20) {
    return c.json({ error: "You are too far from this post to request it" }, 403);
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
    return c.json({ error: NO_LONGER_AVAILABLE }, 409);
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

  // The post now shows as "Requested" in everyone's feed.
  if (!post.isDemo) broadcastFeedChange();

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
requestRoutes.post("/:id/approve", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  if (!isValidUuid(requestId)) {
    return c.json({ error: "Request not found" }, 404);
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
    return c.json({ error: "Only the poster can answer this request" }, 403);
  }

  if (post.status !== "pending_approval") {
    return c.json({ error: "This post is not awaiting approval" }, 409);
  }

  // Two concurrent approve calls (e.g. a double-click) could both pass the
  // status check above before either write commits. approveRequestTx's
  // conditional WHERE clauses make each UPDATE a no-op if the row's status
  // already moved out from under it, and the transaction ensures the
  // request and post flip together — never one without the other.
  const approved = await approveRequestTx(requestId, request.postId);

  if (!approved) {
    return c.json({ error: ALREADY_PROCESSED }, 409);
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
  // The post leaves everyone's feed.
  if (!request.isDemo) broadcastFeedChange();

  return c.json({ message: "Request approved" });
});

// --- Reject request ---
requestRoutes.post("/:id/reject", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  if (!isValidUuid(requestId)) {
    return c.json({ error: "Request not found" }, 404);
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
    return c.json({ error: "Only the poster can answer this request" }, 403);
  }

  if (post.status !== "pending_approval") {
    return c.json({ error: "This post is not awaiting approval" }, 409);
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
    return c.json({ error: ALREADY_PROCESSED }, 409);
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
  // The post is open again.
  if (!request.isDemo) broadcastFeedChange();

  return c.json({ message: "Request rejected" });
});

// --- Cancel request ---
requestRoutes.post("/:id/cancel", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  if (!isValidUuid(requestId)) {
    return c.json({ error: "Request not found" }, 404);
  }

  const request = await findRequestById(requestId);

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  if (request.pickerId !== userId) {
    return c.json({ error: "You can only cancel your own requests" }, 403);
  }

  if (request.status !== "pending") {
    return c.json({ error: ALREADY[request.status] ?? ALREADY_PROCESSED }, 409);
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
    return c.json({ error: ALREADY_PROCESSED }, 409);
  }

  // The cancel has already gone through; the post only decides who to tell.
  const post = await findPostById(request.postId);

  if (post) {
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
  }

  // The post is open again.
  if (!request.isDemo) broadcastFeedChange();

  return c.json({ message: "Request cancelled" });
});

requestRoutes.get("/mine", async (c) => {
  const { userId, isDemo } = c.get("user");

  const requests = await db
    .select({
      id: pickupRequests.id,
      postId: pickupRequests.postId,
      postTitle: foodPosts.title,
      // Enough of the post to show it as a card, and to tell what happened
      // to it (e.g. collected, or ended before an answer). Nothing about
      // where it is: that stays on the post page, for the approved picker.
      postDescription: foodPosts.description,
      postPhotoUrl: foodPosts.photoUrl,
      postStatus: foodPosts.status,
      pickupWindowStart: foodPosts.pickupWindowStart,
      pickupWindowEnd: foodPosts.pickupWindowEnd,
      pickerName: pickupRequests.pickerName,
      etaMinutes: pickupRequests.etaMinutes,
      status: pickupRequests.status,
      isDemo: pickupRequests.isDemo,
      createdAt: pickupRequests.createdAt,
    })
    .from(pickupRequests)
    .innerJoin(foodPosts, eq(pickupRequests.postId, foodPosts.id))
    // Outside demo mode, requests made during a demo stay hidden.
    .where(and(eq(pickupRequests.pickerId, userId), isDemo ? undefined : eq(pickupRequests.isDemo, false)))
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
    const upload = await uploadFromForm(c, "selfies");
    if (!upload.ok) return upload.response;
    return c.json({ url: upload.url }, 201);
  }
);