import { rateLimiter } from "hono-rate-limiter";

const ipKey = (c: any) => c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
const userKey = (c: any) => c.get("userId") ?? ipKey(c); // falls back to IP if no auth

const tooMany = { error: "Too many attempts. Please try again later." };

// Auth limiters (IP-based)
export const forgotPasswordLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
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