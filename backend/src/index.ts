import "dotenv/config";
import "./instrument.js";
import * as Sentry from "@sentry/node";
import { env } from "./env.js";
import { logger } from "./lib/logger.js";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { closeDb } from "./db/index.js";
import { closeAllStreams } from "./lib/notifications/notificationStream.js";

import { startExpiryJob } from "./jobs/expiry.js";
import { startNotificationCleanupJob } from "./jobs/notificationCleanup.js";
import { startUnverifiedUserCleanupJob } from "./jobs/unverifiedUserCleanup.js";
import { startDemoCleanupJob } from "./jobs/demoCleanup.js";

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
  Sentry.captureException(reason);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  Sentry.captureException(err);
  // Sentry sends events over the network asynchronously — exiting right
  // after captureException risks the process dying before the report for
  // the very crash that caused it ever gets sent.
  Sentry.flush(2000).finally(() => process.exit(1));
});

const app = createApp();

const expiryJob = startExpiryJob();
const notificationCleanupJob = startNotificationCleanupJob();
const unverifiedUserCleanupJob = startUnverifiedUserCleanupJob();
const demoCleanupJob = startDemoCleanupJob();

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info(
    {
      port: info.port,
      env: env.APP_ENV,
      cors: env.APP_ENV === "production" ? "jyo.co.in only" : "localhost allowed",
      routes: ["/auth", "/users", "/posts", "/requests", "/notifications"],
      jobs: ["expiry", "notificationCleanup", "unverifiedUserCleanup", "demoCleanup"],
    },
    "JYO backend started"
  );
});

// On deploy/restart, Render sends SIGTERM — without this, in-flight
// requests get cut off mid-response and the DB connection is torn down
// out from under any query still running. Stop taking new work first,
// let what's already in flight finish, then tear down cron jobs and the
// DB connection. A force-exit timeout guards against a hung connection
// blocking shutdown indefinitely.
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Shutting down gracefully");

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await Promise.all([
      expiryJob.stop(),
      notificationCleanupJob.stop(),
      unverifiedUserCleanupJob.stop(),
      demoCleanupJob.stop(),
    ]);

    // Open SSE connections (notifications) never end on their own, so
    // server.close() below would hang waiting on them until forceExit.
    closeAllStreams();

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    await closeDb();
    await Sentry.flush(2000);

    logger.info("Shutdown complete");
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
