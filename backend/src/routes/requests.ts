import { Hono } from "hono";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { haversineDistance } from "../lib/haversine.js";
import { notifyPoster, notifyPicker } from "../lib/mailer.js";
import { uploadFile } from "../lib/storage.js";
import { createRequestLimiter } from "../middleware/limiters.js";
import { z } from "zod";
import { createNotification } from "../lib/notify.js";

import crypto from "crypto";

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

  // Fetch the post
  const [post] = await db
    .select()
    .from(foodPosts)
    .where(eq(foodPosts.id, postId))
    .limit(1);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  // Can't request your own post
  if (post.posterId === userId) {
    return c.json({ error: "You cannot request your own food post" }, 400);
  }

  // Post must be open
  if (post.status !== "open") {
    return c.json({ error: "This post is no longer available for requests" }, 400);
  }

  // Picker must be within 10 km
  const distance = haversineDistance(lat, lng, post.pickupLat, post.pickupLng);
  if (process.env.APP_ENV === "production" && distance > 20) {
    return c.json({ error: "You are too far from this post to request it" }, 400);
  }

  // Insert request
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

  // Move post to pending_approval
  await db
    .update(foodPosts)
    .set({ status: "pending_approval" })
    .where(eq(foodPosts.id, postId));

  // Notify poster
  const [poster] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, post.posterId))
    .limit(1);
  
  createNotification(post.posterId, "Someone wants to pick up your food. Review their request.")
    .catch(console.error);
    
  notifyPoster(poster.email, "request_received");

  return c.json({ message: "Request submitted", request }, 201);
});

// --- Approve request ---
requestRoutes.put("/:id/approve", async (c) => {
  const { userId } = c.get("user");
  const requestId = c.req.param("id");

  // Fetch request
  const [request] = await db
    .select()
    .from(pickupRequests)
    .where(eq(pickupRequests.id, requestId))
    .limit(1);

  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }

  // Fetch the post
  const [post] = await db
    .select()
    .from(foodPosts)
    .where(eq(foodPosts.id, request.postId))
    .limit(1);

  // Only the poster can approve
  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // Post must be in pending_approval
  if (post.status !== "pending_approval") {
    return c.json({ error: "This post is not awaiting approval" }, 400);
  }

  // Approve the request
  await db
    .update(pickupRequests)
    .set({ status: "approved" })
    .where(eq(pickupRequests.id, requestId));

  // Close the post and set approvedRequestId
  await db
    .update(foodPosts)
    .set({ status: "closed", approvedRequestId: requestId })
    .where(eq(foodPosts.id, request.postId));

  // Notify picker
  const [picker] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, request.pickerId))
    .limit(1);

  createNotification(request.pickerId, "Your pickup request was approved. Check the post for the location.")
    .catch(console.error);
  notifyPicker(picker.email, "request_approved");

  await notifyPicker(picker.email, "request_approved");

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

  // Only the poster can reject
  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "pending_approval") {
    return c.json({ error: "This post is not awaiting approval" }, 400);
  }

  // Reject the request
  await db
    .update(pickupRequests)
    .set({ status: "rejected" })
    .where(eq(pickupRequests.id, requestId));

  // Move post back to open
  await db
    .update(foodPosts)
    .set({ status: "open" })
    .where(eq(foodPosts.id, request.postId));

  // Notify picker
  const [picker] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, request.pickerId))
    .limit(1);

  createNotification(request.pickerId, "Your pickup request was rejected.")
    .catch(console.error);
  notifyPicker(picker.email, "request_rejected");

  await notifyPicker(picker.email, "request_rejected");

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

  // Only the picker can cancel
  if (request.pickerId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // Can only cancel before approval
  if (request.status !== "pending") {
    return c.json({ error: "Cannot cancel a request that has already been approved" }, 400);
  }

  // Cancel the request
  await db
    .update(pickupRequests)
    .set({ status: "cancelled" })
    .where(eq(pickupRequests.id, requestId));

  // Move post back to open
  await db
    .update(foodPosts)
    .set({ status: "open" })
    .where(eq(foodPosts.id, request.postId));

  // Notify poster
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

  createNotification(post.posterId, "A picker cancelled their request. Your post is open again.")
    .catch(console.error);
  notifyPoster(poster.email, "request_cancelled");

  await notifyPoster(poster.email, "request_cancelled");

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

requestRoutes.post("/upload-selfie", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop();
  const filename = `${crypto.randomUUID()}.${ext}`;

  const url = await uploadFile(buffer, filename, file.type, "selfies");

  return c.json({ url });
});