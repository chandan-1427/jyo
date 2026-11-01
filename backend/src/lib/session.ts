import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { env } from "../env.js";
import { db } from "../db/index.js";
import { revokedSessions } from "../db/schema.js";
import { isValidUuid } from "./domain/finders.js";

export const SESSION_SECRET = new TextEncoder().encode(env.JWT_SECRET);

const isProd = env.APP_ENV === "production";

// SameSite=Lax: the browser only sends the cookie on requests from the same
// site, so another website can't act as a logged-in user (CSRF; see
// middleware/sameOrigin.ts for the second layer). The app and the API are
// one site (www.jyo.co.in and api.jyo.co.in; localhost ports in
// development), which is all Lax needs. It used to be None in production,
// which sent the cookie with requests from any website.
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

// The session token says only who you are (userId), which generation of
// sessions it belongs to (ver, the account's tokenVersion), and its own id
// (jti), so logging out can end this one session. Anything about the account
// that can change (demo mode, whether it still exists) is read from the
// database on each request by authMiddleware, never trusted from the token,
// which lives for 7 days.
export async function startSession(c: Context, user: { id: string; tokenVersion: number }) {
  const token = await new SignJWT({ userId: user.id, ver: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(crypto.randomUUID())
    .setExpirationTime("7d")
    .sign(SESSION_SECRET);

  setCookie(c, "token", token, cookieOptions);
}

export function endSession(c: Context) {
  deleteCookie(c, "token", cookieOptions);
}

// Logging out ends this session on the server, not only in this browser: the
// token is recorded as revoked until it would have expired, so a copy of the
// cookie (left on a shared phone, say) stops working at once. Other devices
// stay logged in. A token from before sessions had ids can't be singled
// out; it still expires within 7 days of being issued.
export async function revokeSession(c: Context) {
  const token = getCookie(c, "token");
  let revoke: { jti: string; expiresAt: Date } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET, { algorithms: ["HS256"] });
      if (typeof payload.jti === "string" && isValidUuid(payload.jti) && typeof payload.exp === "number") {
        revoke = { jti: payload.jti, expiresAt: new Date(payload.exp * 1000) };
      }
    } catch {
      // Expired or not ours: there's no live session to end.
    }
  }

  if (revoke) await db.insert(revokedSessions).values(revoke).onConflictDoNothing();
  endSession(c);
}
