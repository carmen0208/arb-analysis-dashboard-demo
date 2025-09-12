import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"], // Explicitly include our unit test files
    exclude: ["**/node_modules/**", "**/dist/**"], // Exclude integration tests
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      enabled: true,
      // Include source files first
      include: [
        "src/**/*.ts", // Include all source files
      ],
      // Then exclude what we don't want to cover
      exclude: [
        // Test files
        "src/**/*.test.ts",
        "**/test/**",
        // Config files
        "**/vitest.config.{ts,mts}",
        "**/tsup.config.{ts,mts}",
        "**/tsconfig*.json",
        "**/jest.config.*",
        // Setup files
        "**/test/setup.ts",
        "**/test/helpers/**",
        // Build output
        "**/dist/**",
        // Node modules
        "**/node_modules/**",
        // Environment and other config files
        "**/.env*",
        "**/*.config.{js,ts,mts}",
        "**/types/**",
      ],
      all: true, // Track all files, not just the ones touched by tests
      // Enforce coverage thresholds
      thresholds: {
        lines: 20,
        functions: 20,
        branches: 20,
        statements: 20,
      },
    },
    testTimeout: 20000, // 20 seconds for integration tests
  },
});
