import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { SignJWT } from "jose";
import { env } from "../env.js";

export const SESSION_SECRET = new TextEncoder().encode(env.JWT_SECRET);

const isProd = env.APP_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ("None" as const) : ("Lax" as const),
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

// The session token says only who you are (userId) and which generation of
// sessions it belongs to (ver, the account's tokenVersion). Anything about
// the account that can change (demo mode, whether it still exists) is read
// from the database on each request by authMiddleware, never trusted from
// the token, which lives for 7 days.
export async function startSession(c: Context, user: { id: string; tokenVersion: number }) {
  const token = await new SignJWT({ userId: user.id, ver: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SESSION_SECRET);

  setCookie(c, "token", token, cookieOptions);
}

export function endSession(c: Context) {
  deleteCookie(c, "token", cookieOptions);
}
