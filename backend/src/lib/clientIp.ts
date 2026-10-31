import type { Context } from "hono";
import { BlockList, isIP } from "node:net";
import { getConnInfo } from "@hono/node-server/conninfo";

// Addresses that are never a visitor: Render's own internal hops, loopback,
// link-local, and carrier-grade NAT space.
const internal = new BlockList();
internal.addSubnet("10.0.0.0", 8);
internal.addSubnet("172.16.0.0", 12);
internal.addSubnet("192.168.0.0", 16);
internal.addSubnet("100.64.0.0", 10);
internal.addSubnet("127.0.0.0", 8);
internal.addSubnet("169.254.0.0", 16);
internal.addSubnet("::1", 128, "ipv6");
internal.addSubnet("fc00::", 7, "ipv6");
internal.addSubnet("fe80::", 10, "ipv6");

function isPublicIp(value: string): boolean {
  const family = isIP(value);
  return family !== 0 && !internal.check(value, family === 6 ? "ipv6" : "ipv4");
}

// The visitor's address, as rate limits and logs need it. Every request to
// Render passes through Cloudflare, which sets CF-Connecting-IP to the
// visitor and overwrites any value a client sends, so that comes first.
// X-Forwarded-For is the fallback: a client can write anything into it, and
// each proxy appends after, so only entries from the right can be trusted.
// Its last entry is Render's internal hop (10.x), which made every visitor
// look like one address until October 2026, so the last public entry is
// used instead. The socket address is for local dev, with no proxy at all.
export function getClientIp(c: Context): string {
  const cloudflare = c.req.header("cf-connecting-ip")?.trim();
  if (cloudflare && isIP(cloudflare)) return cloudflare;

  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    const hop = forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .reverse()
      .find(isPublicIp);
    if (hop) return hop;
  }

  // getConnInfo reads the real HTTP server's socket, which doesn't exist
  // when a route is called through Hono's .request() (the test suite).
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

// The rate-limit key for an address. A phone on IPv6 is handed a whole /64
// block and can use any address in it, so the block counts as one visitor.
export function rateLimitAddress(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const groups = expandIpv6(ip);
  return groups ? `${groups.slice(0, 4).join(":")}::/64` : ip;
}

function expandIpv6(ip: string): string[] | null {
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  if (right.some((g) => g.includes("."))) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (tail === undefined && missing !== 0)) return null;
  return [...left, ...Array(missing).fill("0"), ...right].map((g) => g.toLowerCase().padStart(4, "0"));
}
