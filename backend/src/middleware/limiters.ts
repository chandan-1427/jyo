import { createMiddleware } from "hono/factory";
import { rateLimiter } from "hono-rate-limiter";
import { getClientIp } from "../lib/clientIp.js";
import { env } from "../env.js";

// Render sits in front of this app as a reverse proxy (with Cloudflare in
// front of that), so the raw socket address only ever sees Render's own
// internal connection to the container — never the real client. That
// made every IP-keyed limiter below a single global bucket shared by
// every user of the app: one person's failed logins locked out everyone
// else too. getClientIp() reads the real client IP from X-Forwarded-For
// instead — see lib/clientIp.ts for why that's trustworthy here.
const ipKey = (c: any) => getClientIp(c);
const userKey = (c: any) => c.get("user")?.userId ?? ipKey(c); // falls back to IP if no auth

const tooMany = { error: "Too many attempts. Please try again later." };

// Tests call the app directly with no real socket behind them, so
// getConnInfo has nothing to read — and even if it did, every test request
// would share one "unknown" IP bucket, causing unrelated tests to 429 each
// other. Rate limiting itself isn't what these tests are meant to verify,
// so it's a no-op in the test env; the limiters' actual window/limit
// values aren't otherwise exercised by the suite.
const passthrough = createMiddleware(async (_c, next) => next());
const isTest = env.APP_ENV === "test";
const guarded = (limiter: ReturnType<typeof rateLimiter>) => (isTest ? passthrough : limiter);

// Auth limiters (IP-based)
export const forgotPasswordLimiter = guarded(rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  keyGenerator: ipKey,
  message: tooMany,
}));

export const resetPasswordLimiter = guarded(rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: ipKey,
  message: tooMany,
}));

export const resendVerificationLimiter = guarded(rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: ipKey,
  message: tooMany,
}));

export const loginLimiter = guarded(rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  keyGenerator: ipKey,
  message: tooMany,
}));

export const registerLimiter = guarded(rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: ipKey,
  message: tooMany,
}));

// Feature limiters (user-based)
export const createPostLimiter = guarded(rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: userKey,
  message: tooMany,
}));

export const uploadLimiter = guarded(rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: userKey,
  message: tooMany,
}));

export const createRequestLimiter = guarded(rateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 5,
  keyGenerator: userKey,
  message: tooMany,
}));