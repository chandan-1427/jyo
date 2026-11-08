import { Hono } from "hono";
import { env } from "../env.js";
import { findPostById, isValidUuid } from "../lib/domain/finders.js";
import { foodSummaryText } from "../lib/domain/food.js";

export const shareRoutes = new Hono();

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const time = (d: Date) =>
  d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });

// The page a shared link (jyo.co.in/p/:id, which Vercel forwards here) opens.
// WhatsApp and other apps build their link preview from its meta tags; a
// person is sent straight on to the post in the app. Public, so it carries
// only what the feed shows anyone nearby: the photo, title, food details and
// pickup time. Never the location, the poster or anything linking their
// posts. A post that isn't live, or is a demo sample, shares nothing.
shareRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const post = isValidUuid(id) ? await findPostById(id) : null;
  const live =
    !!post &&
    !post.isDemo &&
    (post.status === "open" || post.status === "pending_approval") &&
    post.pickupWindowEnd > new Date();

  const appUrl = env.APP_URL;
  const target = live ? `${appUrl}/posts/${id}` : `${appUrl}/`;

  let title = "Jyo: free food sharing in Tirupati";
  let description = "This food is no longer available. See what neighbours are sharing near you on Jyo.";
  let image = `${appUrl}/og-image.png`;
  if (live && post) {
    title = post.title;
    const food = foodSummaryText(post);
    description = [food ? `${food}.` : "", `Free on Jyo in Tirupati. Pick up by ${time(post.pickupWindowEnd)}.`]
      .filter(Boolean)
      .join(" ");
    if (post.photoUrl) image = post.photoUrl;
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Jyo">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(`${appUrl}/p/${id}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
</head>
<body>
<p><a href="${escapeHtml(target)}">Open on Jyo</a></p>
</body>
</html>`;

  c.header("X-Robots-Tag", "noindex");
  c.header("Cache-Control", "public, max-age=300");
  return c.html(html);
});
