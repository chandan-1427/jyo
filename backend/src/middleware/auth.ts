import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
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
//   reset) is over, as is one for an account that no longer exists. Both
//   clear the cookie and answer 401.
// Tokens signed before `ver` existed count as version 0, the starting value,
// so existing sessions carry on until something bumps it.
export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, "token");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let userId: string;
  let version: number;
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    userId = String(payload.userId);
    version = typeof payload.ver === "number" ? payload.ver : 0;
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  if (!isValidUuid(userId)) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const [account] = await db
    .select({ tokenVersion: users.tokenVersion, isDemo: users.isDemo, demoExpiresAt: users.demoExpiresAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!account || account.tokenVersion !== version) {
    endSession(c);
    return c.json({ error: "Your session has ended. Please log in again." }, 401);
  }

  const demoLive = account.isDemo && (!account.demoExpiresAt || account.demoExpiresAt > new Date());
  c.set("user", { userId, isDemo: demoLive });

  await next();
});
