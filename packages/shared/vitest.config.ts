import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/{api-response,image-options,lan-file,short-video,tools,video-text,xhs-text}.ts"],
      exclude: ["src/**/*.test.ts", "src/__tests__/**"],
      thresholds: { statements: 75, lines: 75, functions: 75, branches: 65 }
    }
  }
});
