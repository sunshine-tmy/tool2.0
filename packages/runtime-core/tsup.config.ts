import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node24",
  bundle: true,
  splitting: false,
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false
});
