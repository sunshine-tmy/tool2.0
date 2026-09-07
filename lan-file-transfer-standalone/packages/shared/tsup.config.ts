import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  outDir: "dist",
  format: ["esm"],
  platform: "neutral",
  target: "es2022",
  bundle: true,
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true
});
