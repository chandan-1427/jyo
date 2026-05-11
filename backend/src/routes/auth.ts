import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const authRoutes = new Hono();

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "None" as const : "Lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

// --- Register ---
authRoutes.post("/register", async (c) => {
  const { name, email, password, phone } = await c.req.json();

  // Basic presence check
  if (!name || !email || !password || !phone) {
    return c.json({ error: "All fields are required" }, 400);
  }

  // Check if email already taken
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 400);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Insert user
  const [newUser] = await db
    .insert(users)
    .values({ name, email, passwordHash, phone })
    .returning({ id: users.id, name: users.name, email: users.email });

  return c.json({ message: "Account created successfully", user: newUser }, 201);
});

// --- Login ---
authRoutes.post("/login", async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  // Find user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Create JWT
  const token = await new SignJWT({ userId: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  // Set cookie
  setCookie(c, "token", token, cookieOptions);

  return c.json({
    message: "Logged in successfully",
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// --- Logout ---
authRoutes.post("/logout", (c) => {
  deleteCookie(c, "token", { path: "/" });
  return c.json({ message: "Logged out successfully" });
});