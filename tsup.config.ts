import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    action: "src/action.ts",
  },
  format: ["esm"],
  clean: true,
  minify: false,
  dts: true,
  sourcemap: true,
  shims: true,
});
