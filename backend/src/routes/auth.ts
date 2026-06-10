import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { forgotPasswordLimiter, resendVerificationLimiter, loginLimiter, registerLimiter } from "../middleware/limiters.js";
import { z } from "zod";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
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

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  phone: z.string().min(10, "Phone number too short").max(15),
});

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

const resendVerificationSchema = z.object({
  email: z.email("Invalid email address"),
});

// --- Register ---
authRoutes.post("/register", registerLimiter, async (c) => {
  const body = await c.req.json();
  const result = registerSchema.safeParse(body);
  
  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { name, email, password, phone } = result.data;

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
authRoutes.post("/login", loginLimiter, async (c) => {
  const body = await c.req.json();
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { email, password } = result.data;

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
authRoutes.post("/forgot-password", forgotPasswordLimiter, async (c) => {
  const body = await c.req.json();
  const result = forgotPasswordSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { email } = result.data;

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
authRoutes.post("/reset-password", resendVerificationLimiter, async (c) => {
  const body = await c.req.json();
  const result = resetPasswordSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { token, password } = result.data;

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

authRoutes.post("/resend-verification", resendVerificationLimiter, async (c) => {
  const body = await c.req.json();
  const result = resendVerificationSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400);
  }

  const { email } = result.data;

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