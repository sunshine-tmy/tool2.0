/**
 * 中文模块说明：项目工程文件，负责 packages/shared/vitest.config.ts
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      // 新增身份适配和链接识别含运行逻辑，必须纳入既有覆盖率门槛，不能按纯 DTO 排除。
      include: [
        "src/{api-response,image-options,lan-file,short-video,tools,video-text,xhs-text,content-archive,media-archive-link,douyin-runtime}.ts"
      ],
      exclude: ["src/**/*.test.ts", "src/__tests__/**"],
      thresholds: { statements: 75, lines: 75, functions: 75, branches: 65 }
    }
  }
});
