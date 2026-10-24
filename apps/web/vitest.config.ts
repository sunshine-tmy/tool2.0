/**
 * 中文模块说明：项目工程文件，负责 frontend/vitest.config.ts
 */
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@toolbox/shared/common": fileURLToPath(new URL("../../packages/shared/src/common/index.ts", import.meta.url)),
      "@toolbox/shared/system": fileURLToPath(new URL("../../packages/shared/src/system/index.ts", import.meta.url)),
      "@toolbox/shared/speech": fileURLToPath(new URL("../../packages/shared/src/speech/index.ts", import.meta.url)),
      "@toolbox/shared/archive": fileURLToPath(new URL("../../packages/shared/src/archive/index.ts", import.meta.url)),
      "@toolbox/shared/lan": fileURLToPath(new URL("../../packages/shared/src/lan/index.ts", import.meta.url)),
      "@toolbox/shared/audio-library": fileURLToPath(
        new URL("../../packages/shared/src/audio-library/index.ts", import.meta.url)
      ),
      "@toolbox/shared/image": fileURLToPath(new URL("../../packages/shared/src/image/index.ts", import.meta.url)),
      "@toolbox/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      "@toolbox/runtime-core": fileURLToPath(new URL("../../packages/runtime-core/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/**/*.ts", "src/**/*.vue", "tooling/style-layers.ts"],
      exclude: ["src/main.ts", "src/app/router.ts", "src/**/types.ts", "src/**/*.test.ts"],
      thresholds: { statements: 75, lines: 75, functions: 75, branches: 65 }
    }
  }
});
