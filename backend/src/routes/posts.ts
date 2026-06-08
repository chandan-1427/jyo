import { Hono } from "hono";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";
import { eq, or, and, gte } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { haversineDistance, isWithinTirupati } from "../lib/haversine.js";
import { uploadFile } from "../lib/storage.js";
import crypto from "crypto";

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

  if (process.env.APP_ENV === "production" && !isWithinTirupati(pickupLat, pickupLng)) {
    return c.json(
      { error: "Jyos is currently only available in Tirupati. Your location is outside the service area." },
      400
    );
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
      posterName: users.name,
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
    .innerJoin(users, eq(foodPosts.posterId, users.id))
    .where(
      and(
        or(
          eq(foodPosts.status, "open"),
          eq(foodPosts.status, "pending_approval")
        ),
        gte(foodPosts.pickupWindowEnd, now)
      )
    );

  // Filter by 10 km radius and strip exact location from response
  const nearbyPosts = posts
    .filter((post) =>
      haversineDistance(userLat, userLng, post.pickupLat, post.pickupLng) <= 20
    )
    .map(({ pickupLat, pickupLng, ...rest }) => rest); // hide exact location
  
  return c.json({ posts: nearbyPosts });
});

postRoutes.get("/mine", async (c) => {
  const { userId } = c.get("user");

  const posts = await db
    .select()
    .from(foodPosts)
    .where(eq(foodPosts.posterId, userId))
    .orderBy(foodPosts.createdAt);

  return c.json({ posts });
});

// --- Get single post ---
postRoutes.get("/:id", async (c) => {
  const { userId } = c.get("user");
  const postId = c.req.param("id");

  // Fetch post with poster name
  const [result] = await db
    .select({
      post: foodPosts,
      posterName: users.name,
    })
    .from(foodPosts)
    .innerJoin(users, eq(foodPosts.posterId, users.id))
    .where(eq(foodPosts.id, postId))
    .limit(1);

  if (!result) {
    return c.json({ error: "Post not found" }, 404);
  }

  const { post, posterName } = result;
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

  // Fetch pending request if poster is viewing pending_approval post
  let pendingRequest = null;
  if (isPoster && post.status === "pending_approval") {
    const [req] = await db
      .select()
      .from(pickupRequests)
      .where(eq(pickupRequests.postId, postId))
      .orderBy(pickupRequests.createdAt)
      .limit(1);
    pendingRequest = req ?? null;
  }

  const showLocation = (isPoster || isApprovedPicker) && post.status === "closed";

  const safePost = showLocation
    ? { ...post, posterName }
    : { ...post, posterName, pickupLat: null, pickupLng: null };

  return c.json({ post: safePost, isPoster, isApprovedPicker, pendingRequest });
});

postRoutes.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop();
  const filename = `${crypto.randomUUID()}.${ext}`;

  const url = await uploadFile(buffer, filename, file.type, "food-photos");

  return c.json({ url });
});

// Poster marks food as received/completed
postRoutes.put("/:id/complete", async (c) => {
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

  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "closed") {
    return c.json({ error: "Post must be closed before completing" }, 400);
  }

  await db
    .update(foodPosts)
    .set({ status: "completed" })
    .where(eq(foodPosts.id, postId));

  return c.json({ message: "Post marked as completed" });
});