import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    app: "src/app.ts",
    server: "src/server.ts"
  },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node24",
  bundle: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: false,
  keepNames: true,
  external: ["@toolbox/shared", "@toolbox/shared/video-text", "@toolbox/shared/short-video"]
});
