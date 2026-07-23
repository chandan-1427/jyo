import "dotenv/config";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { requestLogger } from "./middleware/requestLogger.js";

import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { postRoutes } from "./routes/posts.js";
import { requestRoutes } from "./routes/requests.js";
import { notificationRoutes } from "./routes/notifications.js";

import { startExpiryJob } from "./jobs/expiry.js";

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

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

startExpiryJob();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(
    {
      port: info.port,
      env: env.APP_ENV,
      cors: env.APP_ENV === "production" ? "jyo.co.in only" : "localhost allowed",
      routes: ["/auth", "/users", "/posts", "/requests", "/notifications"],
      jobs: ["expiry"],
    },
    "JYO backend started"
  );
});
