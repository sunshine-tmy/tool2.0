/**
 * 中文模块说明：项目工程文件，负责 packages/shared/tsup.config.ts
 */
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "edge-tts": "src/edge-tts.ts",
    chatterbox: "src/chatterbox.ts"
  },
  outDir: "dist",
  format: ["esm"],
  platform: "neutral",
  target: "es2022",
  bundle: true,
  splitting: false,
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true
});
