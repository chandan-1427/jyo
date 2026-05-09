import { Hono } from "hono";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests } from "../db/schema.js";
import { eq, or, and, lte, gte } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { haversineDistance } from "../lib/haversine.js";

export const postRoutes = new Hono();

postRoutes.use("*", authMiddleware);

// --- Create post ---
postRoutes.post("/", async (c) => {
  const { userId } = c.get("user");
  const body = await c.req.json();

  const {
    title,
    description,
    photoUrl,
    pickupLat,
    pickupLng,
    pickupWindowStart,
    pickupWindowEnd,
  } = body;

  if (!title || !pickupLat || !pickupLng || !pickupWindowStart || !pickupWindowEnd) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const [post] = await db
    .insert(foodPosts)
    .values({
      posterId: userId,
      title,
      description,
      photoUrl,
      pickupLat,
      pickupLng,
      pickupWindowStart: new Date(pickupWindowStart),
      pickupWindowEnd: new Date(pickupWindowEnd),
    })
    .returning();

  return c.json({ message: "Post created", post }, 201);
});

// --- Get feed ---
postRoutes.get("/", async (c) => {
  const { userId } = c.get("user");
  const userLat = parseFloat(c.req.query("lat") ?? "");
  const userLng = parseFloat(c.req.query("lng") ?? "");

  if (isNaN(userLat) || isNaN(userLng)) {
    return c.json({ error: "lat and lng query parameters are required" }, 400);
  }

  const now = new Date();

  // Fetch all active posts within their pickup window
  const posts = await db
    .select({
      id: foodPosts.id,
      posterId: foodPosts.posterId,
      title: foodPosts.title,
      description: foodPosts.description,
      photoUrl: foodPosts.photoUrl,
      pickupLat: foodPosts.pickupLat,
      pickupLng: foodPosts.pickupLng,
      pickupWindowStart: foodPosts.pickupWindowStart,
      pickupWindowEnd: foodPosts.pickupWindowEnd,
      status: foodPosts.status,
      createdAt: foodPosts.createdAt,
    })
    .from(foodPosts)
    .where(
      and(
        or(
          eq(foodPosts.status, "open"),
          eq(foodPosts.status, "pending_approval")
        ),
        lte(foodPosts.pickupWindowStart, now),
        gte(foodPosts.pickupWindowEnd, now)
      )
    );

  // Filter by 10 km radius and strip exact location from response
  const nearbyPosts = posts
    .filter((post) =>
      haversineDistance(userLat, userLng, post.pickupLat, post.pickupLng) <= 10
    )
    .map(({ pickupLat, pickupLng, ...rest }) => rest); // hide exact location

  return c.json({ posts: nearbyPosts });
});

// --- Get single post ---
postRoutes.get("/:id", async (c) => {
  const { userId } = c.get("user");
  const postId = c.req.param("id");

  const [post] = await db
    .select()
    .from(foodPosts)
    .where(eq(foodPosts.id, postId))
    .limit(1);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  const isPoster = post.posterId === userId;

  // Check if requester is the approved picker
  let isApprovedPicker = false;
  if (post.approvedRequestId) {
    const [approvedRequest] = await db
      .select()
      .from(pickupRequests)
      .where(eq(pickupRequests.id, post.approvedRequestId))
      .limit(1);

    isApprovedPicker = approvedRequest?.pickerId === userId;
  }

  // Hide location from everyone except poster and approved picker
  if (!isPoster && !isApprovedPicker) {
    const { pickupLat, pickupLng, ...safePost } = post;
    return c.json({ post: safePost });
  }

  return c.json({ post });
});