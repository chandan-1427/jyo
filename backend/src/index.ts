import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { postRoutes } from "./routes/posts.js";
import { requestRoutes } from "./routes/requests.js";

import { startExpiryJob } from "./jobs/expiry.js";

const app = new Hono();

// --- Middleware ---
app.use(
  "*",
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// --- Routes ---
app.route("/auth", authRoutes);
app.route("/users", userRoutes);
app.route("/posts", postRoutes);
app.route("/requests", requestRoutes);

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