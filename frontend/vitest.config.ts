import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// The app's own Vite config (the "@/" alias, the React plugin), with a
// browser-like DOM for the hooks.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      restoreMocks: true,
      // A fixed API address, whatever a local .env says.
      env: { VITE_API_URL: "https://api.test" },
    },
  })
);
