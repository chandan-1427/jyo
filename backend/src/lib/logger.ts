import pino from "pino";
import { env } from "../env.js";

const isProd = env.APP_ENV === "production";

// JSON logs in production (ingestible by any log aggregator — CloudWatch,
// Loki, Datadog, etc.), pretty-printed in development for readability.
// Never log credentials or tokens, even if a caller passes a whole
// user/request object into a log call by mistake.
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "jyo-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "resetToken",
      "*.resetToken",
      "verificationToken",
      "*.verificationToken",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname,service",
        },
      },
});
