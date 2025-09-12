import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    types: "src/types.ts",
  },
  format: ["cjs", "esm"],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  tsconfig: "../../tsconfig.build.json",
});
