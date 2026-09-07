import { defineConfig } from "tsup";

export default defineConfig({
  entry: { app: "src/app.ts", server: "src/server.ts" },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["@toolbox/shared"]
});
