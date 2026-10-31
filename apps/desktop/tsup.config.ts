import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  noExternal: ["@toolbox/runtime-core", /^@toolbox\/shared/, /^@sinclair\/typebox/],
  external: ["electron", "electron-updater"]
});
