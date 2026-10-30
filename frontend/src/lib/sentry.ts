import * as Sentry from "@sentry/react";

// Query strings can carry a location (the feed's lat/lng) or a one-time
// token (the verify-email and reset-password links), so none reach Sentry:
// they're cut from the page URL attached to an error and from fetch and
// navigation breadcrumbs. The path is enough to tell where it happened.
const withoutQuery =(url: string) => url.split(/[?#]/)[0];

// Called once at app startup — a no-op when VITE_SENTRY_DSN isn't set, so
// local dev doesn't need it configured at all. Error tracking only; no
// performance/session-replay sampling, to keep the free-tier event quota
// for what matters: real render crashes and uncaught errors.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        if (event.request.url) event.request.url = withoutQuery(event.request.url);
        delete event.request.query_string;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      const data = breadcrumb.data;
      if (data) {
        for (const key of ["url", "from", "to"] as const) {
          if (typeof data[key] === "string") data[key] = withoutQuery(data[key]);
        }
      }
      return breadcrumb;
    },
  });
}
