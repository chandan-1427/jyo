// Imported as the very first thing in index.ts, after dotenv/config —
// Sentry's Node SDK needs to initialize before anything else so its
// auto-instrumentation can hook into modules as they're first loaded.
import * as Sentry from "@sentry/node";
import { env } from "./env.js";

// Query strings can carry a location (the feed's lat/lng), so none reach
// Sentry: they're cut from the request URL attached to an error and from
// breadcrumbs. The path is enough to tell which route failed.
const withoutQuery = (url: string) => url.split("?")[0];

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    // Error tracking only — no performance tracing, to keep the free-tier
    // event quota for what actually matters: real crashes and bugs.
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        if (event.request.url) event.request.url = withoutQuery(event.request.url);
        delete event.request.query_string;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (typeof breadcrumb.data?.url === "string") breadcrumb.data.url = withoutQuery(breadcrumb.data.url);
      return breadcrumb;
    },
  });
}
