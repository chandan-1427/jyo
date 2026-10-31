import { Hono, type Context } from "hono";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, and, lt, sql } from "drizzle-orm";
import crypto from "crypto";
import { forgotPasswordLimiter, resetPasswordLimiter, resendVerificationLimiter, loginLimiter, registerLimiter } from "../middleware/limiters.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../lib/mailer.js";
import { logger } from "../lib/logger.js";
import { findUserByEmail } from "../lib/domain/finders.js";
import { authMiddleware } from "../middleware/auth.js";
import { DEMO_SESSION_MS } from "../lib/domain/demo.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from "../lib/validation.js";
import { parseJsonBody } from "../lib/http.js";
import { endSession, startSession } from "../lib/session.js";

export const authRoutes = new Hono();

// Precomputed bcrypt hash of a random value that will never match any real
// password — compared against on a login attempt for an unknown email so
// the response takes the same time as a real "wrong password" attempt,
// instead of returning early and leaking account existence via timing.
const DUMMY_PASSWORD_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8O9YtbnHUb.z35p1SICtjy0G1kGGxq";

// Matches the 24-hour expiry the frontend already tells users about on the
// verification-failed screen — previously there was no actual expiry check,
// so an old or leaked verification link worked forever.
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// --- Register ---
authRoutes.post("/register", registerLimiter, async (c) => {
  const parsed = await parseJsonBody(c, registerSchema);
  if (!parsed.ok) return parsed.response;

  const { name, email, password, phone } = parsed.data;

  const existing = await findUserByEmail(email);

  // An unverified signup whose token has expired never got cleaned up yet
  // (the daily cleanup job may not have run) — treat it as reclaimable
  // rather than permanently squatting the email address.
  const reclaimable =
    existing &&
    !existing.emailVerified &&
    existing.verificationTokenExpiry !== null &&
    existing.verificationTokenExpiry < new Date();

  if (existing && !reclaimable) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  let newUser;
  if (reclaimable) {
    // Conditional update guarded on the same expired/unverified state we
    // just checked — if another request reclaimed or verified this row in
    // between, zero rows match and we report the email as taken instead of
    // silently overwriting a now-live account.
    const [updated] = await db
      .update(users)
      .set({ name, passwordHash, phone, verificationToken, verificationTokenExpiry })
      .where(
        and(
          eq(users.id, existing.id),
          eq(users.emailVerified, false),
          lt(users.verificationTokenExpiry, new Date())
        )
      )
      .returning({ id: users.id, name: users.name, email: users.email });

    if (!updated) {
      return c.json({ error: "Email already registered" }, 409);
    }
    newUser = updated;
  } else {
    try {
      [newUser] = await db
        .insert(users)
        .values({ name, email, passwordHash, phone, verificationToken, verificationTokenExpiry })
        .returning({ id: users.id, name: users.name, email: users.email });
    } catch (err: any) {
      // Unique-violation: two concurrent registrations raced past the
      // "existing" check above for the same email. drizzle-orm 0.45's
      // postgres-js driver wraps the raw driver error in a
      // DrizzleQueryError with the original PostgresError on `.cause`, so
      // the unique-violation code has to be checked on both.
      if (err?.code === "23505" || err?.cause?.code === "23505") {
        return c.json({ error: "Email already registered" }, 409);
      }
      throw err;
    }
  }

  // Send verification email — fire and forget
  sendVerificationEmail(email, verificationToken)
    .catch((err) => logger.error({ err, userId: newUser.id }, "Verification email failed"));

  return c.json({
    message: "Account created. Please check your email to verify your account.",
    user: newUser,
  }, 201);
});

// --- Login ---
authRoutes.post("/login", loginLimiter, async (c) => {
  const parsed = await parseJsonBody(c, loginSchema);
  if (!parsed.ok) return parsed.response;

  const { email, password } = parsed.data;

  // Find user
  const user = await findUserByEmail(email);

  if (!user) {
    // Still run a bcrypt comparison so the response takes roughly the same
    // time as a real login attempt — otherwise an attacker could tell
    // "no such account" apart from "wrong password" just by timing.
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
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

  await startSession(c, user);

  return c.json({
    message: "Logged in successfully",
    user: { id: user.id, name: user.name, email: user.email, isDemo: user.isDemo },
  });
});

// --- Logout ---
authRoutes.post("/logout", (c) => {
  endSession(c);
  return c.json({ message: "Logged out successfully" });
});

// Demo mode lives on the account row, which authMiddleware reads on every
// request, so starting or ending it takes effect at once on every device,
// with no new cookie. The account can't vanish between authMiddleware's
// check and these updates in practice, but if it does, that's a 401.
const accountGone = (c: Context) => {
  endSession(c);
  return c.json({ error: "Your session has ended. Please log in again." }, 401);
};

// --- Start demo mode ---
// Anyone can opt in — visitors outside Tirupati who hit a dead end at the
// feed, and Tirupati locals exploring the app while there are few real
// posts to see (see docs/demo-mode-plan.md).
authRoutes.post("/demo/start", authMiddleware, async (c) => {
  const { userId } = c.get("user");
  const demoExpiresAt = new Date(Date.now() + DEMO_SESSION_MS);

  const [updated] = await db
    .update(users)
    .set({ isDemo: true, demoExpiresAt })
    .where(eq(users.id, userId))
    .returning({ id: users.id, name: users.name, email: users.email, isDemo: users.isDemo });

  if (!updated) return accountGone(c);

  return c.json({ message: "Demo mode started", demoExpiresAt, user: updated });
});

// --- Stop demo mode ---
// Lets a user leave early instead of waiting out the full session — demo
// content they created keeps its own expiry and is swept up by the usual
// cleanup cron regardless of when they exit.
authRoutes.post("/demo/stop", authMiddleware, async (c) => {
  const { userId } = c.get("user");

  const [updated] = await db
    .update(users)
    .set({ isDemo: false, demoExpiresAt: null })
    .where(eq(users.id, userId))
    .returning({ id: users.id, name: users.name, email: users.email, isDemo: users.isDemo });

  if (!updated) return accountGone(c);

  return c.json({ message: "Demo mode ended", user: updated });
});

// --- Verify email ---
// A POST, since it changes the account. The email's link opens the app's
// /verify-email page, which sends the token here.
authRoutes.post("/verify-email", async (c) => {
  const parsed = await parseJsonBody(c, verifyEmailSchema);
  if (!parsed.ok) return parsed.response;

  const { token } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.verificationToken, token))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid or expired verification link" }, 400);
  }

  if (!user.verificationTokenExpiry || user.verificationTokenExpiry < new Date()) {
    return c.json({ error: "Verification link has expired. Please request a new one." }, 400);
  }

  await db
    .update(users)
    .set({ emailVerified: true, verificationToken: null, verificationTokenExpiry: null })
    .where(eq(users.id, user.id));

  return c.json({ message: "Email verified successfully. You can now log in." });
});

// --- Forgot password ---
authRoutes.post("/forgot-password", forgotPasswordLimiter, async (c) => {
  const parsed = await parseJsonBody(c, forgotPasswordSchema);
  if (!parsed.ok) return parsed.response;

  const { email } = parsed.data;

  const user = await findUserByEmail(email);

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
    .catch((err) => logger.error({ err, userId: user.id }, "Reset email failed"));

  return c.json({ message: "If that email is registered you will receive a reset link." });
});

// --- Reset password ---
authRoutes.post("/reset-password", resetPasswordLimiter, async (c) => {
  const parsed = await parseJsonBody(c, resetPasswordSchema);
  if (!parsed.ok) return parsed.response;

  const { token, password } = parsed.data;

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

  // Bumping tokenVersion ends every session signed before, on every device:
  // if the password was reset because someone else had the account, their
  // login stops working too, not just in 7 days when the cookie expires.
  await db
    .update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, user.id));

  return c.json({ message: "Password reset successfully. You can now log in." });
});

// The same answer whether the email has no account, a verified one, or one
// waiting to be verified, so this can't be used to find out which emails
// have accounts (as with forgot-password). Only the last gets an email.
const RESEND_MESSAGE = "If that email has an account waiting to be verified, a new link is on its way. Please check your inbox.";

authRoutes.post("/resend-verification", resendVerificationLimiter, async (c) => {
  const parsed = await parseJsonBody(c, resendVerificationSchema);
  if (!parsed.ok) return parsed.response;

  const { email } = parsed.data;

  const user = await findUserByEmail(email);

  if (!user || user.emailVerified) {
    return c.json({ message: RESEND_MESSAGE });
  }

  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await db
    .update(users)
    .set({ verificationToken, verificationTokenExpiry })
    .where(eq(users.id, user.id));

  sendVerificationEmail(email, verificationToken)
    .catch((err) => logger.error({ err, userId: user.id }, "Resend verification failed"));

  return c.json({ message: RESEND_MESSAGE });
});