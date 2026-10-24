/**
 * 中文模块说明：项目工程文件，负责 backend/vitest.config.ts
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
      "@toolbox/shared/desktop": fileURLToPath(new URL("../../packages/shared/src/desktop/types.ts", import.meta.url)),
      "@toolbox/runtime-core": fileURLToPath(new URL("../../packages/runtime-core/src/index.ts", import.meta.url)),
      "@toolbox/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    maxWorkers: 1,
    minWorkers: 1,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/server.ts",
        "src/database/cli.ts",
        "src/database/benchmark.ts",
        "src/types/**",
        "src/**/*.test.ts",
        "src/__tests__/**"
      ],
      thresholds: { statements: 75, lines: 75, functions: 75, branches: 65 }
    }
  }
});
