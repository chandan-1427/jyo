import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import * as Sentry from "@sentry/node";
import { logger } from "./lib/logger.js";

import { requestLogger } from "./middleware/requestLogger.js";
import { sameOrigin } from "./middleware/sameOrigin.js";
import { env } from "./env.js";
import { limitBodySize } from "./lib/http.js";
import { addressLimiter } from "./middleware/limiters.js";

import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { postRoutes } from "./routes/posts.js";
import { requestRoutes } from "./routes/requests.js";
import { notificationRoutes } from "./routes/notifications.js";
import { pushRoutes } from "./routes/push.js";
import { shareRoutes } from "./routes/share.js";
import { statsRoutes } from "./routes/stats.js";
import { adminRoutes } from "./routes/admin.js";

// The local dev server only outside production: allowed on the live API, any
// page served on someone's machine at that address (Vite's default port, so
// any local project) could act as them while they're logged in to Jyo.
export function allowedOriginsFor(appEnv: string) {
  return appEnv === "production"
    ? ["https://jyo.co.in", "https://www.jyo.co.in"]
    : ["https://jyo.co.in", "https://www.jyo.co.in", "http://localhost:5173"];
}

// Extracted from index.ts so tests can exercise the exact same route
// wiring/middleware/error handling as production, instead of a hand-
// maintained copy that could silently drift out of sync.
export function createApp() {
  const app = new Hono();

  const allowedOrigins = allowedOriginsFor(env.APP_ENV);

  app.use("*", requestLogger);

  // On every response, errors included. The API only ever answers with JSON
  // (and the notification stream), so nothing may load or frame it, and
  // browsers are told to use HTTPS for it from now on, as www already does.
  // Same-site, not same-origin: www.jyo.co.in reads it.
  app.use(
    "*",
    secureHeaders({
      strictTransportSecurity: "max-age=63072000; includeSubDomains",
      xFrameOptions: "DENY",
      referrerPolicy: "no-referrer",
      crossOriginResourcePolicy: "same-site",
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    })
  );

  // Before CORS and the routes: an action sent from another website's page
  // is refused outright (see middleware/sameOrigin.ts).
  app.use("*", sameOrigin(allowedOrigins));

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin || allowedOrigins.includes(origin)) return origin;
        return null;
      },
      credentials: true,
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  // After CORS, so a 429 or 413 carries CORS headers and the app can show
  // its message.
  app.use("*", addressLimiter);
  app.use("*", limitBodySize);

  app.onError((err, c) => {
    const requestId = c.get("requestId");

    logger.error(
      { err, requestId, method: c.req.method, path: c.req.path },
      "Unhandled error"
    );

    // Routes return their own clean 4xx JSON directly for expected
    // failures (bad input, wrong password, unauthorized, etc.) — anything
    // that reaches here is, by construction, a genuinely unexpected bug
    // worth reporting, not routine traffic.
    Sentry.captureException(err, {
      extra: { requestId, method: c.req.method, path: c.req.path },
    });

    return c.json({ error: "Internal server error" }, 500);
  });

  // JSON like every other error, so a client reading `error` gets a message
  // rather than failing to parse Hono's default plain-text "404 Not Found".
  app.notFound((c) => c.json({ error: "Not found" }, 404));

  app.get("/", (c) => c.json({ status: "ok" }));

  app.route("/auth", authRoutes);
  app.route("/users", userRoutes);
  app.route("/posts", postRoutes);
  app.route("/requests", requestRoutes);
  app.route("/notifications", notificationRoutes);
  app.route("/push", pushRoutes);
  app.route("/share", shareRoutes);
  app.route("/stats", statsRoutes);
  app.route("/admin", adminRoutes);

  return app;
}
