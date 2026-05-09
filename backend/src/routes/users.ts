import { Hono } from "hono";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

export const userRoutes = new Hono();

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

  // Only pick allowed fields — ignore anything else sent in body
  const { name, phone, locationText, description } = body;

  // Build update object with only provided fields
  const updates: Record<string, string> = {};
  if (name)         updates.name = name;
  if (phone)        updates.phone = phone;
  if (locationText) updates.locationText = locationText;
  if (description)  updates.description = description;

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