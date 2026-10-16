import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // validation.parity.test.ts imports frontend/src/lib/validation.ts, which
      // imports "zod". CI installs only the backend's packages, so point that
      // import at the backend's own zod (the same major version).
      { find: /^zod$/, replacement: fileURLToPath(new URL("./node_modules/zod/index.js", import.meta.url)) },
    ],
  },
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
