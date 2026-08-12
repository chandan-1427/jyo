import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

// Render sits in front of this app as the one trusted reverse proxy, so the
// raw socket address is always Render's own internal connection, never the
// real client. Each hop *appends* its own address to X-Forwarded-For rather
// than replacing it, so a client can freely set their own fake entries —
// the only entry we can trust is the last one, appended by Render's edge
// itself. Taking the first entry would let a client spoof the rate-limit
// key on every request by sending an arbitrary X-Forwarded-For value.
// Falls back to the raw socket address for local dev, where there's no
// proxy in front at all.
export function getClientIp(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    const entries = forwardedFor.split(",");
    return entries[entries.length - 1].trim();
  }
  // getConnInfo reads the real HTTP server's underlying socket, which
  // doesn't exist when a route is called directly via Hono's .request()
  // (the test suite, no real server behind it) — falls back to "unknown"
  // instead of throwing.
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}
