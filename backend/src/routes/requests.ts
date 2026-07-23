import { Hono } from "hono";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { haversineDistance } from "../lib/haversine.js";
import { notifyPoster, notifyPicker } from "../lib/mailer.js";
import { uploadFile } from "../lib/storage.js";
import { createRequestLimiter, uploadLimiter } from "../middleware/limiters.js";
import { z } from "zod";
import { createNotification } from "../lib/notify.js";

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
  const { userId } = c.get("user");
  const body = await c.req.json();
  const result = createRequestSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { postId, pickerName, selfieUrl, etaMinutes, lat, lng } = result.data;

  const [post] = await db
    .select()
    .from(foodPosts)
    .where(eq(foodPosts.id, postId))
    .limit(1);

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
  if (process.env.APP_ENV === "production" && distance > 20) {
    return c.json({ error: "You are too far from this post to request it" }, 400);
  }

  // Atomically claim the post — the status condition in the WHERE clause
  // prevents two concurrent requests from both passing the check above and
  // creating duplicate pending requests for the same post.
  const [claimedPost] = await db
    .update(foodPosts)
    .set({ status: "pending_approval" })
    .where(and(eq(foodPosts.id, postId), eq(foodPosts.status, "open")))
    .returning({ id: foodPosts.id });

  if (!claimedPost) {
    return c.json({ error: "This post is no longer available for requests" }, 400);
  }

  const [request] = await db
    .insert(pickupRequests)
    .values({
      postId,
      pickerId: userId,
      pickerName,
      selfieUrl,
      etaMinutes,
    })
    .returning();

  const [poster] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, post.posterId))
    .limit(1);

  createNotification(
    post.posterId,
    "Someone wants to pick up your food. Review their request.",
    postId,
    "request_received"
  ).catch(console.error);

  notifyPoster(poster.email, "request_received");

  return c.json({ message: "Request submitted", request }, 201);
});

// --- Approve request ---
requestRoutes.put("/:id/approve", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  const [request] = await db
    .select()
    .from(pickupRequests)
    .where(eq(pickupRequests.id, requestId))
    .limit(1);

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  const [post] = await db
    .select()
    .from(foodPosts)
    .where(eq(foodPosts.id, request.postId))
    .limit(1);

  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "pending_approval") {
    return c.json({ error: "This post is not awaiting approval" }, 400);
  }

  await db
    .update(pickupRequests)
    .set({ status: "approved" })
    .where(eq(pickupRequests.id, requestId));

  await db
    .update(foodPosts)
    .set({ status: "closed", approvedRequestId: requestId })
    .where(eq(foodPosts.id, request.postId));

  const [picker] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, request.pickerId))
    .limit(1);

  createNotification(
    request.pickerId,
    "Your pickup request was approved. Check the post for the location.",
    request.postId,
    "request_approved"
  ).catch(console.error);

  notifyPicker(picker.email, "request_approved");
  // duplicate `await notifyPicker(...)` call removed — was sending this
  // email twice on every approval

  return c.json({ message: "Request approved" });
});

// --- Reject request ---
requestRoutes.put("/:id/reject", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  const [request] = await db
    .select()
    .from(pickupRequests)
    .where(eq(pickupRequests.id, requestId))
    .limit(1);

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  const [post] = await db
    .select()
    .from(foodPosts)
    .where(eq(foodPosts.id, request.postId))
    .limit(1);

  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "pending_approval") {
    return c.json({ error: "This post is not awaiting approval" }, 400);
  }

  await db
    .update(pickupRequests)
    .set({ status: "rejected" })
    .where(eq(pickupRequests.id, requestId));

  await db
    .update(foodPosts)
    .set({ status: "open" })
    .where(eq(foodPosts.id, request.postId));

  const [picker] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, request.pickerId))
    .limit(1);

  createNotification(
    request.pickerId,
    "Your pickup request was rejected.",
    request.postId,
    "request_rejected"
  ).catch(console.error);

  notifyPicker(picker.email, "request_rejected");
  // duplicate call removed here too

  return c.json({ message: "Request rejected" });
});

// --- Cancel request ---
requestRoutes.put("/:id/cancel", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  const [request] = await db
    .select()
    .from(pickupRequests)
    .where(eq(pickupRequests.id, requestId))
    .limit(1);

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  if (request.pickerId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (request.status !== "pending") {
    return c.json({ error: "Cannot cancel a request that has already been approved" }, 400);
  }

  await db
    .update(pickupRequests)
    .set({ status: "cancelled" })
    .where(eq(pickupRequests.id, requestId));

  await db
    .update(foodPosts)
    .set({ status: "open" })
    .where(eq(foodPosts.id, request.postId));

  const [post] = await db
    .select({ posterId: foodPosts.posterId })
    .from(foodPosts)
    .where(eq(foodPosts.id, request.postId))
    .limit(1);

  const [poster] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, post.posterId))
    .limit(1);

  createNotification(
    post.posterId,
    "A picker cancelled their request. Your post is open again.",
    request.postId,
    "request_cancelled"
  ).catch(console.error);

  notifyPoster(poster.email, "request_cancelled");
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
      createdAt: pickupRequests.createdAt,
    })
    .from(pickupRequests)
    .innerJoin(foodPosts, eq(pickupRequests.postId, foodPosts.id))
    .where(eq(pickupRequests.pickerId, userId))
    .orderBy(desc(pickupRequests.createdAt));

  return c.json({ requests });
});

requestRoutes.post("/upload-selfie", uploadLimiter, async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await uploadFile(buffer, file.type, "selfies");
    return c.json({ url });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Upload failed" }, 400);
  }
});