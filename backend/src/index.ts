import "dotenv/config";
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
  "http://localhost:5173", // keep for local dev
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

// --- Routes ---
app.get("/", (c) => c.json({ status: "ok" }));

app.route("/auth", authRoutes);
app.route("/users", userRoutes);
app.route("/posts", postRoutes);
app.route("/requests", requestRoutes);
app.route("/notifications", notificationRoutes);

// --- Start ---
const port = Number(process.env.PORT) || 3000;

startExpiryJob();

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);