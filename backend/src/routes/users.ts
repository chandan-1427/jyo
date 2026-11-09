import { Hono, type Context } from "hono";
import { db } from "../db/index.js";
import { foodPosts, pickupRequests, users } from "../db/schema.js";
import { and, eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { deleteFile, type Bucket } from "../lib/storage.js";
import { deleteAccountLimiter, uploadLimiter, userLimiter } from "../middleware/limiters.js";
import { deleteAccountSchema, updateProfileSchema } from "../lib/validation.js";
import { verifyPassword } from "../lib/passwords.js";
import { endSession } from "../lib/session.js";
import { deleteAccount, PICKUP_IN_PROGRESS } from "../lib/domain/deleteAccount.js";
import { broadcastFeedChange, closeUserStreams } from "../lib/notifications/notificationStream.js";
import { logger } from "../lib/logger.js";
import { parseJsonBody, uploadFromForm } from "../lib/http.js";
import { listBlocks, unblock } from "../lib/domain/safety.js";
import { isValidUuid } from "../lib/domain/finders.js";

export const userRoutes = new Hono();

// Shared between the GET /me select and PATCH /me's update().returning() —
// both want the same public profile shape, just via a different query.
const profileColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  locationText: users.locationText,
  description: users.description,
  avatarUrl: users.avatarUrl,
  isDemo: users.isDemo,
  demoExpiresAt: users.demoExpiresAt,
  createdAt: users.createdAt,
};

// Apply auth middleware to all user routes
userRoutes.use("*", authMiddleware, userLimiter);

// --- Get own profile ---
userRoutes.get("/me", async (c) => {
  const { userId, isAdmin } = c.get("user");

  const [user] = await db
    .select(profileColumns)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user: { ...user, isAdmin } });
});

const userGone = (c: Context) => c.json({ error: "User not found" }, 404);

// --- Own activity counts, for the profile ---
// Counted here rather than from My posts and My requests, which only load a
// page at a time. Demo-mode posts and requests count only while in demo mode.
userRoutes.get("/me/stats", async (c) => {
  const { userId, isDemo } = c.get("user");

  const [posts] = await db
    .select({
      shared: sql<number>`count(*)::int`,
      pickedUp: sql<number>`(count(*) filter (where ${foodPosts.status} = 'completed'))::int`,
      mealsShared: sql<number>`coalesce(sum(coalesce(${foodPosts.servings}, 1)) filter (where ${foodPosts.status} = 'completed'), 0)::int`,
    })
    .from(foodPosts)
    .where(and(eq(foodPosts.posterId, userId), isDemo ? undefined : eq(foodPosts.isDemo, false)));

  const [requests] = await db
    .select({ requested: sql<number>`count(*)::int` })
    .from(pickupRequests)
    .where(and(eq(pickupRequests.pickerId, userId), isDemo ? undefined : eq(pickupRequests.isDemo, false)));

  return c.json({ stats: { ...posts, ...requests } });
});

// --- Update own profile ---
// A PATCH: only the fields sent are changed.
userRoutes.patch("/me", async (c) => {
  const { userId } = c.get("user");
  const parsed = await parseJsonBody(c, updateProfileSchema);
  if (!parsed.ok) return parsed.response;

  const { name, phone, locationText, description } = parsed.data;

  // Build update object with only explicitly provided fields — an empty
  // string for a nullable field (locationText/description) clears it.
  const updates: Record<string, string> = {};
  if (name !== undefined)         updates.name = name;
  if (phone !== undefined)        updates.phone = phone;
  if (locationText !== undefined) updates.locationText = locationText;
  if (description !== undefined)  updates.description = description;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields provided to update" }, 400);
  }

  const [updatedUser] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning(profileColumns);

  if (!updatedUser) return userGone(c);

  return c.json({ message: "Profile updated", user: updatedUser });
});

// --- Upload/replace own avatar ---
// Not exposed via PATCH /me's updateProfileSchema: avatarUrl must only ever
// point at a file this endpoint itself uploaded to the "avatars" bucket
// (validated by uploadFile's magic-byte check), never an arbitrary
// client-supplied URL.
userRoutes.post(
  "/me/avatar",
  uploadLimiter,
  async (c) => {
    const { userId } = c.get("user");
    const upload = await uploadFromForm(c, "avatars");
    if (!upload.ok) return upload.response;
    const { url } = upload;

    const [previous] = await db
      .select({ avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [updatedUser] = await db
      .update(users)
      .set({ avatarUrl: url })
      .where(eq(users.id, userId))
      .returning(profileColumns);

    if (!updatedUser) {
      await deleteFile(url, "avatars");
      return userGone(c);
    }

    // Best-effort — leaving the old file orphaned in storage is cheap
    // compared to failing this request over a cleanup step.
    if (previous?.avatarUrl) {
      await deleteFile(previous.avatarUrl, "avatars");
    }

    return c.json({ message: "Avatar updated", user: updatedUser });
  }
);

// --- Remove own avatar ---
userRoutes.delete("/me/avatar", async (c) => {
  const { userId } = c.get("user");

  const [previous] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [updatedUser] = await db
    .update(users)
    .set({ avatarUrl: null })
    .where(eq(users.id, userId))
    .returning(profileColumns);

  if (!updatedUser) return userGone(c);

  if (previous?.avatarUrl) {
    await deleteFile(previous.avatarUrl, "avatars");
  }

  return c.json({ message: "Avatar removed", user: updatedUser });
});
// --- Delete own account ---
// Hidden at once and erased after 30 days, photos deleted now: see
// lib/domain/deleteAccount.ts. The password is asked for again (a session
// left open on someone else's phone mustn't be enough), and wrong guesses are
// rate-limited. Every session ends at once: the middleware refuses a deleted
// account.
// --- People you've blocked ---
userRoutes.get("/me/blocks", async (c) => {
  const { userId } = c.get("user");
  return c.json({ blocks: await listBlocks(userId) });
});

// Only your own block. Already gone answers as if just removed.
userRoutes.delete("/me/blocks/:id", async (c) => {
  const { userId } = c.get("user");
  const blockId = c.req.param("id");
  if (!isValidUuid(blockId)) return c.json({ error: "Block not found" }, 404);
  await unblock(userId, blockId);
  return c.json({ message: "Unblocked" });
});

userRoutes.delete("/me", deleteAccountLimiter, async (c) => {
  const { userId } = c.get("user");
  const parsed = await parseJsonBody(c, deleteAccountSchema);
  if (!parsed.ok) return parsed.response;

  const [account] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!account) return userGone(c);

  if (!(await verifyPassword(parsed.data.password, account.passwordHash))) {
    return c.json({ error: "That password isn't right." }, 403);
  }

  const result = await deleteAccount(userId);
  if (result.status === "pickup_in_progress") {
    return c.json({ error: PICKUP_IN_PROGRESS }, 409);
  }

  endSession(c);
  closeUserStreams(userId);
  if (result.feedChanged) broadcastFeedChange();

  const files: [string, Bucket][] = [
    ...(result.avatarUrl ? [[result.avatarUrl, "avatars"] as [string, Bucket]] : []),
    ...result.photoUrls.map((url): [string, Bucket] => [url, "food-photos"]),
    ...result.selfieUrls.map((url): [string, Bucket] => [url, "selfies"]),
  ];
  for (const [url, bucket] of files) {
    deleteFile(url, bucket).catch((err) => logger.error({ err, bucket }, "Failed to delete a deleted account's file"));
  }

  return c.json({ message: "Your account has been deleted." });
});
