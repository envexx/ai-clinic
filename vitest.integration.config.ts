import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Integration tests run against the configured DATABASE_URL. Local Prisma
 * Postgres accepts only one connection, so tests run in a single fork.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // Local Prisma Postgres accepts one connection at a time.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
