import { createMiddleware } from "hono/factory";
import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "@hono/node-server/conninfo";
import { env } from "../env.js";

// Uses the actual socket remote address rather than the client-suppliable
// X-Forwarded-For header, which anyone can spoof to get a fresh rate-limit
// bucket per request. If this ever runs behind a trusted reverse proxy that
// overwrites X-Forwarded-For, switch back to reading that header instead.
const ipKey = (c: any) => getConnInfo(c).remote.address ?? "unknown";
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