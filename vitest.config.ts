import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Database tests share one database; run files one at a time.
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
    // Tests call a hosted database over the network.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Load .env.local (and .env.development.local) so tests use the dev branch.
    env: loadEnv(mode === "test" ? "development" : mode, process.cwd(), ""),
  },
}));
