import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "short-video": "src/short-video.ts",
    "video-text": "src/video-text.ts"
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
