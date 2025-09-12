module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  env: {
    node: true,
    browser: true,
    es2021: true,
  },
  rules: {
    "prettier/prettier": "error",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  settings: {
    "import/resolver": {
      typescript: {},
    },
  },
  ignorePatterns: ["dist", "node_modules", ".turbo", "*.js", "pnpm-lock.yaml"],
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};
