import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { every } from "hono/combine";
import { rateLimiter } from "hono-rate-limiter";
import { getClientIp, rateLimitAddress } from "../lib/clientIp.js";
import { env } from "../env.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Many people can share one address: a hostel or college Wi-Fi, or a mobile
// carrier's NAT (Jio and Airtel put large numbers of phones behind each IPv4
// address). So limits keyed only by address are kept high, and the tight
// ones are keyed by the account or email address they protect.
const byAddress = (c: Context) => rateLimitAddress(getClientIp(c));
const byUser = (c: Context) => c.get("user")?.userId ?? byAddress(c);

// The email a login, sign-up or reset is for. Hono keeps the parsed body, so
// the route reads it again for free; a body that isn't JSON gets a 400 there.
async function byEmail(c: Context) {
  try {
    const body = await c.req.json();
    return typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}
const byEmailAndAddress = async (c: Context) => `${await byEmail(c)}|${byAddress(c)}`;

export const limitKeys = { byAddress, byUser, byEmail, byEmailAndAddress };

type LimitOptions = {
  windowMs: number;
  limit: number;
  key: (c: Context) => string | Promise<string>;
  message: string;
  // Count only requests that fail (a wrong password), not every request.
  onlyFailures?: boolean;
};

// Answers a 429 in the app's usual { error } shape, with Retry-After.
export function buildLimiter({ windowMs, limit, key, message, onlyFailures = false }: LimitOptions): MiddlewareHandler {
  return rateLimiter({
    windowMs,
    limit,
    keyGenerator: key,
    skipSuccessfulRequests: onlyFailures,
    message: { error: message },
  });
}

// Tests call the app directly with no real socket behind them, so every
// request would share one address and unrelated tests would 429 each other.
// Limits are off there; tests/rate-limits.test.ts exercises buildLimiter.
const passthrough = createMiddleware(async (_c, next) => next());
const limiter = (options: LimitOptions) => (env.APP_ENV === "test" ? passthrough : buildLimiter(options));

// --- Whole app ---
// Far above what anyone using the app sends; stops a script hammering it.
export const addressLimiter = limiter({
  windowMs: MINUTE,
  limit: 600,
  key: byAddress,
  message: "Too many requests. Please wait a minute and try again.",
});

export const userLimiter = limiter({
  windowMs: MINUTE,
  limit: 300,
  key: byUser,
  message: "Too many requests. Please wait a minute and try again.",
});

// --- Login ---
// Only wrong passwords count, so logging in normally never uses any up.
// Per account from one network for typos; per account from anywhere for
// guessing spread across many addresses; per network for trying many
// accounts at once.
const LOGIN_MESSAGE = "Too many failed logins. Please wait 15 minutes and try again.";
export const loginLimiter = every(
  limiter({ windowMs: 15 * MINUTE, limit: 10, key: byEmailAndAddress, message: LOGIN_MESSAGE, onlyFailures: true }),
  limiter({ windowMs: HOUR, limit: 30, key: byEmail, message: LOGIN_MESSAGE, onlyFailures: true }),
  limiter({ windowMs: 15 * MINUTE, limit: 100, key: byAddress, message: LOGIN_MESSAGE, onlyFailures: true })
);

// --- Endpoints that send an email ---
// Limited by the address emailed too, so nobody can flood someone's inbox
// through Jyo (or use up the sending quota real users' emails need) by
// spreading the requests over many networks.
const EMAIL_MESSAGE = "Too many emails asked for this address. Please wait an hour and try again.";
const NETWORK_MESSAGE = "Too many tries from your network. Please wait an hour and try again.";
const emailLimiter = (perAddressEmailed: number) =>
  every(
    limiter({ windowMs: HOUR, limit: 20, key: byAddress, message: NETWORK_MESSAGE }),
    limiter({ windowMs: HOUR, limit: perAddressEmailed, key: byEmail, message: EMAIL_MESSAGE })
  );

export const registerLimiter = emailLimiter(5);
export const forgotPasswordLimiter = emailLimiter(3);
export const resendVerificationLimiter = emailLimiter(3);

export const resetPasswordLimiter = limiter({ windowMs: HOUR, limit: 20, key: byAddress, message: NETWORK_MESSAGE });

// --- Creating things ---
export const createPostLimiter = limiter({
  windowMs: HOUR,
  limit: 10,
  key: byUser,
  message: "You can share food up to 10 times an hour. Please try again later.",
});

// Shared by food photos, selfies and profile photos.
export const uploadLimiter = limiter({
  windowMs: HOUR,
  limit: 20,
  key: byUser,
  message: "Too many photos uploaded in the last hour. Please try again later.",
});

export const createRequestLimiter = limiter({
  windowMs: 10 * MINUTE,
  limit: 5,
  key: byUser,
  message: "You've asked for food 5 times in 10 minutes. Please wait a few minutes and try again.",
});
