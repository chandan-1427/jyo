import { Hono } from "hono";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import { z } from "zod";

export const userRoutes = new Hono();

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  phone: z.string().min(10, "Phone number too short").max(15).optional(),
  locationText: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
});

// Apply auth middleware to all user routes
userRoutes.use("*", authMiddleware);

// --- Get own profile ---
userRoutes.get("/me", async (c) => {
  const { userId } = c.get("user");

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      locationText: users.locationText,
      description: users.description,
      createdAt: users.createdAt,
    })
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
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      locationText: users.locationText,
      description: users.description,
      createdAt: users.createdAt,
    });

  return c.json({ message: "Profile updated", user: updatedUser });
});