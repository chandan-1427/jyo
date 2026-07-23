import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "@hono/node-server/conninfo";

// Uses the actual socket remote address rather than the client-suppliable
// X-Forwarded-For header, which anyone can spoof to get a fresh rate-limit
// bucket per request. If this ever runs behind a trusted reverse proxy that
// overwrites X-Forwarded-For, switch back to reading that header instead.
const ipKey = (c: any) => getConnInfo(c).remote.address ?? "unknown";
const userKey = (c: any) => c.get("user")?.userId ?? ipKey(c); // falls back to IP if no auth

const tooMany = { error: "Too many attempts. Please try again later." };

// Auth limiters (IP-based)
export const forgotPasswordLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  keyGenerator: ipKey,
  message: tooMany,
});

export const resetPasswordLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: ipKey,
  message: tooMany,
});

export const resendVerificationLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: ipKey,
  message: tooMany,
});

export const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  keyGenerator: ipKey,
  message: tooMany,
});

export const registerLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: ipKey,
  message: tooMany,
});

// Feature limiters (user-based)
export const createPostLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: userKey,
  message: tooMany,
});

export const uploadLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: userKey,
  message: tooMany,
});

export const createRequestLimiter = rateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 5,
  keyGenerator: userKey,
  message: tooMany,
});