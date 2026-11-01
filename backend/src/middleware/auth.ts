import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { jwtVerify } from "jose";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { revokedSessions, users } from "../db/schema.js";
import { SESSION_SECRET, endSession } from "../lib/session.js";
import { isValidUuid } from "../lib/domain/finders.js";

type AuthUser = {
  userId: string;
  isDemo: boolean;
};

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

// The token proves who you are; the account row decides the rest, read
// fresh on every request (one lookup by primary key). So:
// - demo mode is whatever the account says now, with an expired demo
//   counting as over even before the cleanup job resets it. (It used to be
//   a claim in the 7-day token: after a demo ended with the tab closed, the
//   server kept treating the user as a demo visitor, and their real posts
//   were saved as demo posts that nobody else could see.)
// - a session from before the account's tokenVersion was bumped (password
//   reset) is over, as is one that was logged out (revoked_sessions, checked
//   in the same query) and one for an account that no longer exists. All
//   three clear the cookie and answer 401.
// Tokens signed before `ver` existed count as version 0, the starting value,
// so existing sessions carry on until something bumps it.
export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, "token");

  if (!token) {
    return c.json({ error: "Please log in to continue." }, 401);
  }

  let userId: string;
  let version: number;
  let jti: string | null;
  try {
    // Only the algorithm sessions are signed with is accepted.
    const { payload } = await jwtVerify(token, SESSION_SECRET, { algorithms: ["HS256"] });
    userId = String(payload.userId);
    version = typeof payload.ver === "number" ? payload.ver : 0;
    // Tokens issued before sessions had ids have none.
    jti = payload.jti === undefined ? null : String(payload.jti);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  if (!isValidUuid(userId) || (jti !== null && !isValidUuid(jti))) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const [account] = await db
    .select({
      tokenVersion: users.tokenVersion,
      isDemo: users.isDemo,
      demoExpiresAt: users.demoExpiresAt,
      revoked: jti
        ? sql<boolean>`exists (select 1 from ${revokedSessions} where ${revokedSessions.jti} = ${jti})`
        : sql<boolean>`false`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!account || account.tokenVersion !== version || account.revoked) {
    endSession(c);
    return c.json({ error: "Your session has ended. Please log in again." }, 401);
  }

  const demoLive = account.isDemo && (!account.demoExpiresAt || account.demoExpiresAt > new Date());
  c.set("user", { userId, isDemo: demoLive });

  await next();
});
