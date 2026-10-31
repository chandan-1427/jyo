import { createMiddleware } from "hono/factory";

// Refuses any request that changes something (anything but GET, HEAD,
// OPTIONS) when a browser says it came from another website: cross-site
// request forgery. A page elsewhere can make a logged-in visitor's browser
// send a "simple" POST (a form, or fetch with text/plain or no body) along
// with the session cookie; CORS stops that page reading the answer, but
// not the action itself (approving a request, posting, replacing the
// profile photo). The cookie is SameSite=Lax too, but this also covers
// cookies set before that, and any browser that ignores SameSite.
//
// Browsers send Origin on such requests, and Sec-Fetch-Site on nearly all.
// A request with neither isn't from a browser page (curl, the tests, a
// server), so it can't be forged this way, and is let through.
export const sameOrigin = (allowedOrigins: readonly string[]) =>
  createMiddleware(async (c, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) return next();

    const origin = c.req.header("Origin");
    const fetchSite = c.req.header("Sec-Fetch-Site");
    const foreign = origin ? !allowedOrigins.includes(origin) : fetchSite === "cross-site";

    if (foreign) {
      return c.json({ error: "Requests from other websites aren't allowed" }, 403);
    }
    await next();
  });
