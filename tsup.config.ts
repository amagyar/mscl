import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  minify: false,
  dts: true,
  sourcemap: true,
  shims: true,
});
