import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

// Render sits in front of this app as a reverse proxy, so the raw socket
// address is always Render's own internal connection, never the real
// client. Render's edge sets the first entry in X-Forwarded-For to the
// real client IP — falls back to the raw socket address for local dev,
// where there's no proxy in front at all.
export function getClientIp(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
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
