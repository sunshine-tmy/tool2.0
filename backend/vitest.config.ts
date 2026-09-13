import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@toolbox/shared/video-text": fileURLToPath(new URL("../packages/shared/src/video-text.ts", import.meta.url)),
      "@toolbox/shared": fileURLToPath(new URL("../packages/shared/src/index.ts", import.meta.url))
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
      exclude: ["src/server.ts", "src/database/cli.ts", "src/types/**", "src/**/*.test.ts", "src/__tests__/**"],
      thresholds: { statements: 75, lines: 75, functions: 75, branches: 65 }
    }
  }
});
