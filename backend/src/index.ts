import "dotenv/config";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

import { startExpiryJob } from "./jobs/expiry.js";
import { startNotificationCleanupJob } from "./jobs/notificationCleanup.js";

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

const app = createApp();

startExpiryJob();
startNotificationCleanupJob();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(
    {
      port: info.port,
      env: env.APP_ENV,
      cors: env.APP_ENV === "production" ? "jyo.co.in only" : "localhost allowed",
      routes: ["/auth", "/users", "/posts", "/requests", "/notifications"],
      jobs: ["expiry", "notificationCleanup"],
    },
    "JYO backend started"
  );
});
