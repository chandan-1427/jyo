import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  notifyPoster,
  notifyPicker,
} from "../lib/mailer.js";

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

  if (!name || !email || !password || !phone) {
    return c.json({ error: "All fields are required" }, 400);
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString("hex");

  const [newUser] = await db
    .insert(users)
    .values({ name, email, passwordHash, phone, verificationToken })
    .returning({ id: users.id, name: users.name, email: users.email });

  // Send verification email — fire and forget
  sendVerificationEmail(email, verificationToken)
    .catch((err) => console.error("[MAILER] Verification email failed:", err));

  return c.json({
    message: "Account created. Please check your email to verify your account.",
    user: newUser,
  }, 201);
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

  if (!user.emailVerified) {
    return c.json({ error: "Please verify your email before logging in. Check your inbox for the verification link." }, 403);
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
  deleteCookie(c, "token", cookieOptions);
  return c.json({ message: "Logged out successfully" });
});

// --- Verify email ---
authRoutes.get("/verify-email", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.json({ error: "Token is required" }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.verificationToken, token))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid or expired verification link" }, 400);
  }

  await db
    .update(users)
    .set({ emailVerified: true, verificationToken: null })
    .where(eq(users.id, user.id));

  return c.json({ message: "Email verified successfully. You can now log in." });
});

// --- Forgot password ---
authRoutes.post("/forgot-password", async (c) => {
  const { email } = await c.req.json();

  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return success even if email not found — prevents email enumeration
  if (!user) {
    return c.json({ message: "If that email is registered you will receive a reset link." });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(users)
    .set({ resetToken, resetTokenExpiry })
    .where(eq(users.id, user.id));

  sendPasswordResetEmail(email, resetToken)
    .catch((err) => console.error("[MAILER] Reset email failed:", err));

  return c.json({ message: "If that email is registered you will receive a reset link." });
});

// --- Reset password ---
authRoutes.post("/reset-password", async (c) => {
  const { token, password } = await c.req.json();

  if (!token || !password) {
    return c.json({ error: "Token and new password are required" }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid or expired reset link" }, 400);
  }

  // Check expiry
  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return c.json({ error: "Reset link has expired. Please request a new one." }, 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db
    .update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, user.id));

  return c.json({ message: "Password reset successfully. You can now log in." });
});

// Resend verification email
authRoutes.post("/resend-verification", async (c) => {
  const { email } = await c.req.json();

  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return success even if user not found
  if (!user) {
    return c.json({ message: "If that email is registered you will receive a new verification link." });
  }

  if (user.emailVerified) {
    return c.json({ error: "This email is already verified. Please log in." }, 400);
  }

  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString("hex");

  await db
    .update(users)
    .set({ verificationToken })
    .where(eq(users.id, user.id));

  sendVerificationEmail(email, verificationToken)
    .catch((err) => console.error("[MAILER] Resend verification failed:", err));

  return c.json({ message: "Verification email sent. Please check your inbox." });
});