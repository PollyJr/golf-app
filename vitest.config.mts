import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@db": path.resolve(import.meta.dirname, "db"),
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside a React Server Component bundle.
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://fairway:fairway@127.0.0.1:5432/fairway_test",
      DATABASE_SSL: "false",
      SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
      IP_HASH_SECRET: "test-ip-hash-secret-with-at-least-32-characters",
    },
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    // Integration tests share one database; run files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
