/**
 * 中文模块说明：项目工程文件，负责 packages/shared/tsup.config.ts
 */
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    image: "src/image/index.ts",
    "audio-library": "src/audio-library/index.ts",
    lan: "src/lan/index.ts",
    archive: "src/archive/index.ts",
    speech: "src/speech/index.ts",
    system: "src/system/index.ts",
    common: "src/common/index.ts",
    desktop: "src/desktop/types.ts",
    "edge-tts": "src/speech/edge-tts.ts",
    chatterbox: "src/speech/chatterbox.ts"
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
