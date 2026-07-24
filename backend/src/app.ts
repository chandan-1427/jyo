import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "./lib/logger.js";

import { requestLogger } from "./middleware/requestLogger.js";

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

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin || allowedOrigins.includes(origin)) return origin;
        return null;
      },
      credentials: true,
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
  );

  app.onError((err, c) => {
    logger.error(
      {
        err,
        requestId: c.get("requestId"),
        method: c.req.method,
        path: c.req.path,
      },
      "Unhandled error"
    );
    return c.json({ error: "Internal server error" }, 500);
  });

  app.get("/", (c) => c.json({ status: "ok" }));

  app.route("/auth", authRoutes);
  app.route("/users", userRoutes);
  app.route("/posts", postRoutes);
  app.route("/requests", requestRoutes);
  app.route("/notifications", notificationRoutes);

  return app;
}
