import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";
import { eq, or, and, gte, asc, desc, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { haversineDistance, isWithinTirupati } from "../lib/geo/haversine.js";
import { uploadFile, deleteFile, MAX_UPLOAD_REQUEST_BYTES } from "../lib/storage.js";
import { isValidUuid, findPostById } from "../lib/domain/finders.js";
import { z } from "zod";
import { createPostLimiter, uploadLimiter } from "../middleware/limiters.js";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { provisionSeededPost, seedRequestOnOwnPost, DEMO_SESSION_MS } from "../lib/domain/demo.js";
import { createPostSchema, updatePostSchema } from "../lib/validation.js";
import { ConflictError } from "../lib/errors.js";
import { broadcastFeedChange } from "../lib/notifications/notificationStream.js";

export const postRoutes = new Hono();

postRoutes.use("*", authMiddleware);

// --- Create post ---
postRoutes.post("/", createPostLimiter, async (c) => {
  const { userId, isDemo } = c.get("user");
  const body = await c.req.json();
  const result = createPostSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { title, description, photoUrl, pickupLat, pickupLng, pickupWindowStart, pickupWindowEnd } = result.data;

  if (env.APP_ENV === "production" && !isDemo && !isWithinTirupati(pickupLat, pickupLng)) {
    return c.json(
      { error: "Jyo is currently only available in Tirupati. Your location is outside the service area." },
      400
    );
  }

  // A demo visitor's own post is itself demo-flagged so it (and the
  // synthetic request seeded onto it below) disappears with the rest of
  // their session — see docs/demo-mode-plan.md.
  const demoExpiresAt = isDemo ? new Date(Date.now() + DEMO_SESSION_MS) : null;

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
      isDemo,
      demoExpiresAt,
    })
    .returning();

  if (isDemo && demoExpiresAt) {
    seedRequestOnOwnPost(post.id, userId, demoExpiresAt)
      .catch((err) => logger.error({ err, postId: post.id }, "Failed to seed demo request on own post"));
  } else {
    broadcastFeedChange();
  }

  return c.json({ message: "Post created", post }, 201);
});

// --- Get feed ---
postRoutes.get("/", async (c) => {
  const { userId, isDemo } = c.get("user");
  const userLat = parseFloat(c.req.query("lat") ?? "");
  const userLng = parseFloat(c.req.query("lng") ?? "");

  if (isNaN(userLat) || isNaN(userLng)) {
    return c.json({ error: "lat and lng query parameters are required" }, 400);
  }

  if (isDemo) {
    await provisionSeededPost(userId, userLat, userLng);
  }

  const now = new Date();

  // Fetch all active posts within their pickup window. The poster's name is
  // left out: paired with a rough area it tells a stranger who lives nearby
  // (e.g. that a woman is posting from there). See the /:id handler.
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
      isDemo: foodPosts.isDemo,
      createdAt: foodPosts.createdAt,
    })
    .from(foodPosts)
    .where(
      and(
        or(
          eq(foodPosts.status, "open"),
          eq(foodPosts.status, "pending_approval")
        ),
        gte(foodPosts.pickupWindowEnd, now),
        // Demo posts are seeded for one specific visitor's session — never
        // show them to anyone else's feed, nor to that visitor once they've
        // left demo mode (the rows outlive the session until cleanup).
        isDemo
          ? or(eq(foodPosts.isDemo, false), eq(foodPosts.seededForUserId, userId))
          : eq(foodPosts.isDemo, false)
      )
    )
    // Posts someone can still request come first, and within each group the
    // one whose pickup ends soonest leads: that's the food closest to being
    // wasted. createdAt and id make the order total, so it's identical on
    // every fetch; without an ORDER BY, Postgres may return rows in a new
    // order after any update, and cards would jump around on each live refresh.
    .orderBy(
      sql`case when ${foodPosts.status} = 'open' then 0 else 1 end`,
      asc(foodPosts.pickupWindowEnd),
      asc(foodPosts.createdAt),
      asc(foodPosts.id)
    );

  // Filter by 20 km radius and strip exact location from response
  const nearbyPosts = posts
    .filter((post) =>
      haversineDistance(userLat, userLng, post.pickupLat, post.pickupLng) <= 20
    )
    .map(({ pickupLat, pickupLng, ...rest }) => rest); // hide exact location
  
  return c.json({ posts: nearbyPosts });
});

postRoutes.get("/mine", async (c) => {
  const { userId, isDemo } = c.get("user");

  const posts = await db
    .select()
    .from(foodPosts)
    // Outside demo mode, posts made during a demo stay hidden.
    .where(and(eq(foodPosts.posterId, userId), isDemo ? undefined : eq(foodPosts.isDemo, false)))
    .orderBy(desc(foodPosts.createdAt));

  return c.json({ posts });
});

// --- Get single post ---
postRoutes.get("/:id", async (c) => {
  const { userId } = c.get("user");
  const postId = c.req.param("id");

  if (!isValidUuid(postId)) {
    return c.json({ error: "Post not found" }, 404);
  }

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
      .where(
        and(
          eq(pickupRequests.postId, postId),
          eq(pickupRequests.status, "pending")
        )
      )
      .orderBy(desc(pickupRequests.createdAt))  // newest first
      .limit(1);
    pendingRequest = req ?? null;
  }

  const showLocation = (isPoster || isApprovedPicker) && post.status === "closed";

  // The poster's name follows the same rule as the location: only the poster
  // and the picker they approved get it, so the picker knows who to meet.
  const safePost = showLocation
    ? { ...post, posterName }
    : { ...post, posterName: isPoster ? posterName : null, pickupLat: null, pickupLng: null };

  return c.json({ post: safePost, isPoster, isApprovedPicker, pendingRequest });
});

postRoutes.post(
  "/upload",
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
      const url = await uploadFile(buffer, "food-photos");
      return c.json({ url });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Upload failed" }, 400);
    }
  }
);

// Poster marks food as received/completed
postRoutes.put("/:id/complete", async (c) => {
  const { userId } = c.get("user");
  const postId = c.req.param("id");

  if (!isValidUuid(postId)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const post = await findPostById(postId);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "closed") {
    return c.json({ error: "Post must be closed before completing" }, 400);
  }

  // Same double-click/concurrent-request guard as approve/reject/cancel —
  // the conditional WHERE makes this a no-op if the post already moved out
  // of "closed" between the check above and this write.
  const [completed] = await db
    .update(foodPosts)
    .set({ status: "completed" })
    .where(and(eq(foodPosts.id, postId), eq(foodPosts.status, "closed")))
    .returning({ id: foodPosts.id });

  if (!completed) {
    return c.json({ error: "This post has already been processed" }, 400);
  }

  return c.json({ message: "Post marked as completed" });
});

// Once someone has asked for a post, it's what they asked for: the poster
// can no longer change it or take it away. Editing is only possible while
// the post is open; deleting also while it's expired (nothing is pending).
const LOCKED_MESSAGE = "Someone has already asked for this food, so it can't be changed or deleted.";

// --- Edit post ---
postRoutes.put("/:id", async (c) => {
  const { userId } = c.get("user");
  const postId = c.req.param("id");

  if (!isValidUuid(postId)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const body = await c.req.json();
  const result = updatePostSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const post = await findPostById(postId);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "open") {
    return c.json({ error: post.status === "expired" ? "This post has ended. Post the food again instead." : LOCKED_MESSAGE }, 400);
  }

  const { title, description, photoUrl, pickupWindowStart, pickupWindowEnd } = result.data;

  // Same guard as approve/reject/cancel: conditional on the post still being
  // open, so a request that claims it between the check above and this
  // write wins, and the edit doesn't change food someone just asked for.
  const [updated] = await db
    .update(foodPosts)
    .set({
      title,
      description: description ?? post.description,
      photoUrl: photoUrl ?? post.photoUrl,
      pickupWindowStart: new Date(pickupWindowStart),
      pickupWindowEnd: new Date(pickupWindowEnd),
    })
    .where(and(eq(foodPosts.id, postId), eq(foodPosts.status, "open")))
    .returning();

  if (!updated) {
    return c.json({ error: LOCKED_MESSAGE }, 400);
  }

  // A replaced photo is no longer referenced anywhere.
  if (post.photoUrl && updated.photoUrl !== post.photoUrl) {
    deleteFile(post.photoUrl, "food-photos")
      .catch((err) => logger.error({ err, postId }, "Failed to delete replaced post photo"));
  }

  if (!post.isDemo) broadcastFeedChange();

  return c.json({ message: "Post updated", post: updated });
});

// --- Delete post ---
postRoutes.delete("/:id", async (c) => {
  const { userId } = c.get("user");
  const postId = c.req.param("id");

  if (!isValidUuid(postId)) {
    return c.json({ error: "Post not found" }, 404);
  }

  const post = await findPostById(postId);

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  if (post.posterId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (post.status !== "open" && post.status !== "expired") {
    return c.json({ error: LOCKED_MESSAGE }, 400);
  }

  // The post row is locked (FOR UPDATE) and its status re-checked inside the
  // transaction. Without that, a request could claim the post between the
  // check above and the deletes below, and the delete would silently wipe
  // out that new pending request along with the post. A request racing this
  // waits on the lock, then finds the post gone and gets a clean
  // "no longer available".
  const relatedRequests = await db
    .transaction(async (tx) => {
      const [locked] = await tx
        .select({ status: foodPosts.status })
        .from(foodPosts)
        .where(eq(foodPosts.id, postId))
        .for("update");

      if (!locked || (locked.status !== "open" && locked.status !== "expired")) throw new ConflictError();

      // Only rejected/cancelled requests can exist here. Their rows have to
      // go first (foreign key), and their selfies are cleaned up below.
      const removed = await tx
        .delete(pickupRequests)
        .where(eq(pickupRequests.postId, postId))
        .returning({ selfieUrl: pickupRequests.selfieUrl });

      await tx.delete(foodPosts).where(eq(foodPosts.id, postId));
      return removed;
    })
    .catch((err) => {
      if (err instanceof ConflictError) return null;
      throw err;
    });

  if (!relatedRequests) {
    return c.json({ error: LOCKED_MESSAGE }, 400);
  }

  if (!post.isDemo) broadcastFeedChange();

  if (post.photoUrl) {
    deleteFile(post.photoUrl, "food-photos")
      .catch((err) => logger.error({ err, postId }, "Failed to delete post photo"));
  }
  for (const req of relatedRequests) {
    if (req.selfieUrl) {
      deleteFile(req.selfieUrl, "selfies")
        .catch((err) => logger.error({ err, postId }, "Failed to delete request selfie"));
    }
  }

  return c.json({ message: "Post deleted successfully" });
});
