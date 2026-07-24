import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    hookTimeout: 30000,
    testTimeout: 15000,
    // Route/DB tests share one Postgres connection pool per worker and
    // truncate tables between tests — running test files in parallel
    // workers would let two files stomp on each other's rows.
    fileParallelism: false,
  },
});
