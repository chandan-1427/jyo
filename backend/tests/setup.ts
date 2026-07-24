import { config } from "dotenv";

// Loaded before any test file's imports run, so env.ts's fail-fast
// validation sees the test DATABASE_URL/JWT_SECRET/etc rather than the
// real .env — critical, since importing any route module transitively
// imports env.ts and validates eagerly.
config({ path: ".env.test" });
