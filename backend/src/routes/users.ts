import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { uploadFile, deleteFile, MAX_UPLOAD_REQUEST_BYTES } from "../lib/storage.js";
import { uploadLimiter } from "../middleware/limiters.js";
import { z } from "zod";

export const userRoutes = new Hono();

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  phone: z.string().min(10, "Phone number too short").max(15).optional(),
  locationText: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
});

// Shared between the GET /me select and PUT /me's update().returning() —
// both want the same public profile shape, just via a different query.
const profileColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  locationText: users.locationText,
  description: users.description,
  avatarUrl: users.avatarUrl,
  createdAt: users.createdAt,
};

// Apply auth middleware to all user routes
userRoutes.use("*", authMiddleware);

// --- Get own profile ---
userRoutes.get("/me", async (c) => {
  const { userId } = c.get("user");

  const [user] = await db
    .select(profileColumns)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});

// --- Update own profile ---
userRoutes.put("/me", async (c) => {
  const { userId } = c.get("user");
  const body = await c.req.json();

  const result = updateProfileSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { name, phone, locationText, description } = result.data;

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

  return c.json({ message: "Profile updated", user: updatedUser });
});

// --- Upload/replace own avatar ---
// Not exposed via PUT /me's updateProfileSchema: avatarUrl must only ever
// point at a file this endpoint itself uploaded to the "avatars" bucket
// (validated by uploadFile's magic-byte check), never an arbitrary
// client-supplied URL.
userRoutes.post(
  "/me/avatar",
  uploadLimiter,
  bodyLimit({
    maxSize: MAX_UPLOAD_REQUEST_BYTES,
    onError: (c) => c.json({ error: "File is too large. Maximum size is 5MB." }, 413),
  }),
  async (c) => {
    const { userId } = c.get("user");
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json({ error: "No file provided" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let url: string;
    try {
      url = await uploadFile(buffer, "avatars");
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Upload failed" }, 400);
    }

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

  if (previous?.avatarUrl) {
    await deleteFile(previous.avatarUrl, "avatars");
  }

  return c.json({ message: "Avatar removed", user: updatedUser });
});