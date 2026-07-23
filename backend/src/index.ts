import "dotenv/config";
import { env } from "./env.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { postRoutes } from "./routes/posts.js";
import { requestRoutes } from "./routes/requests.js";
import { notificationRoutes } from "./routes/notifications.js";

import { startExpiryJob } from "./jobs/expiry.js";

const app = new Hono();

const allowedOrigins = [
  "https://jyo.co.in",
  "https://www.jyo.co.in",
  "http://localhost:5173",
];

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

app.get("/", (c) => c.json({ status: "ok" }));

app.route("/auth", authRoutes);
app.route("/users", userRoutes);
app.route("/posts", postRoutes);
app.route("/requests", requestRoutes);
app.route("/notifications", notificationRoutes);

startExpiryJob();

serve(
  { fetch: app.fetch, port: env.PORT },
  (info) => {
    const isProd = env.APP_ENV === "production";

    console.log(`
┌─────────────────────────────────────────────┐
│           JYO Backend — Running             │
├─────────────────────────────────────────────┤
│ Port    : ${String(info.port).padEnd(34)}│
│ Env     : ${env.APP_ENV.padEnd(34)}│
│ CORS    : ${(isProd ? "jyo.co.in only" : "localhost allowed").padEnd(34)}│
├─────────────────────────────────────────────┤
│ Routes  : /auth /users /posts               │
│           /requests /notifications          │
│ Jobs    : expiry ✓                          │
└─────────────────────────────────────────────┘
    `.trim());
  }
);