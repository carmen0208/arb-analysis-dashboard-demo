import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      enabled: true,
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "**/test/**",
        "**/vitest.config.{ts,mts}",
        "**/tsup.config.{ts,mts}",
        "**/tsconfig*.json",
        "**/dist/**",
        "**/node_modules/**",
        "**/.env*",
        "**/*.config.{js,ts,mts}",
        "**/types/**",
      ],
      all: true,
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 20,
        statements: 20,
      },
    },
    testTimeout: 10000,
  },
});
