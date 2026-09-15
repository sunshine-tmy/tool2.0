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
      "@toolbox/shared/video-text": fileURLToPath(new URL("../packages/shared/src/video-text.ts", import.meta.url)),
      "@toolbox/shared": fileURLToPath(new URL("../packages/shared/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: [
        "src/**/*.ts",
        "src/components/RouteLoading.vue",
        "src/components/UiErrorBoundary.vue",
        "src/components/tool/ToolPageHeader.vue"
      ],
      exclude: ["src/main.ts", "src/app/router.ts", "src/**/types.ts", "src/**/*.test.ts"],
      thresholds: { statements: 75, lines: 75, functions: 75, branches: 65 }
    }
  }
});
