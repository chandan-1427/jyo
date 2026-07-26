import * as Sentry from "@sentry/react";

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
  });
}
