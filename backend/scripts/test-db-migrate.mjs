// Applies migrations to the test database before the suite runs. Loads
// .env.test *before* drizzle.config.ts's own `import "dotenv/config"` gets a
// chance to run — dotenv doesn't override already-set vars, so setting
// DATABASE_URL here first means the real .env's DATABASE_URL never wins.
import { config } from "dotenv";
import { execSync } from "child_process";

config({ path: ".env.test" });

execSync("drizzle-kit migrate", { stdio: "inherit", env: process.env });
