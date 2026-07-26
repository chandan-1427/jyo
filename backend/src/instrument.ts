// Imported as the very first thing in index.ts, after dotenv/config —
// Sentry's Node SDK needs to initialize before anything else so its
// auto-instrumentation can hook into modules as they're first loaded.
import * as Sentry from "@sentry/node";
import { env } from "./env.js";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    // Error tracking only — no performance tracing, to keep the free-tier
    // event quota for what actually matters: real crashes and bugs.
    tracesSampleRate: 0,
  });
}
