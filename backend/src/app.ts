import { Hono } from "hono";
import { cors } from "hono/cors";
import * as Sentry from "@sentry/node";
import { logger } from "./lib/logger.js";

import { requestLogger } from "./middleware/requestLogger.js";
import { sameOrigin } from "./middleware/sameOrigin.js";
import { limitBodySize } from "./lib/http.js";

import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { postRoutes } from "./routes/posts.js";
import { requestRoutes } from "./routes/requests.js";
import { notificationRoutes } from "./routes/notifications.js";

// Extracted from index.ts so tests can exercise the exact same route
// wiring/middleware/error handling as production, instead of a hand-
// maintained copy that could silently drift out of sync.
export function createApp() {
  const app = new Hono();

  const allowedOrigins = [
    "https://jyo.co.in",
    "https://www.jyo.co.in",
    "http://localhost:5173",
  ];

  app.use("*", requestLogger);

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

  // After CORS, so a 413 carries CORS headers and the app can show its message.
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

  return app;
}
