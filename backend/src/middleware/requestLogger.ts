import { createMiddleware } from "hono/factory";
import crypto from "crypto";
import { logger } from "../lib/logger.js";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

// Every request gets a short-lived structured log line with enough to
// trace it end-to-end and debug production issues: a request ID (also
// echoed back as a header so a client-reported bug can be grepped for),
// method/path, status, latency, and the authenticated user if any.
export const requestLogger = createMiddleware(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  const start = performance.now();
  const { method } = c.req;
  const path = c.req.path;

  await next();

  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  const status = c.res.status;
  const user = c.get("user");

  const fields = {
    requestId,
    method,
    path,
    status,
    durationMs,
    userId: user?.userId,
  };
  const message = `${method} ${path} ${status} ${durationMs}ms`;

  if (status >= 500) {
    logger.error(fields, message);
  } else if (status >= 400) {
    logger.warn(fields, message);
  } else {
    logger.info(fields, message);
  }
});
