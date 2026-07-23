// Centralized, fail-fast environment loading. Importing this module
// validates all required variables are present — a missing/misspelled
// var throws at boot instead of letting the app run with an empty or
// undefined secret (e.g. an empty JWT signing key).

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
] as const;

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  APP_URL: process.env.APP_URL ?? "http://localhost:5173",
  PORT: Number(process.env.PORT) || 3000,
  APP_ENV: process.env.APP_ENV ?? "development",
  LOG_LEVEL:
    process.env.LOG_LEVEL ??
    (process.env.APP_ENV === "production" ? "info" : "debug"),
};
