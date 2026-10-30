import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { deleteFile, MAX_UPLOAD_REQUEST_BYTES } from "../lib/storage.js";
import { uploadLimiter } from "../middleware/limiters.js";
import { updateProfileSchema } from "../lib/validation.js";
import { parseJsonBody, uploadFromForm } from "../lib/http.js";

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

const userGone = (c: Context) => c.json({ error: "User not found" }, 404);

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
  bodyLimit({
    maxSize: MAX_UPLOAD_REQUEST_BYTES,
    onError: (c) => c.json({ error: "File is too large. Maximum size is 5MB." }, 413),
  }),
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