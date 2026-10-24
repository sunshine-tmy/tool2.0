/**
 * 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
 */
import { rm } from "node:fs/promises";

await Promise.all(
  ["apps/api/dist", "apps/web/dist", "packages/shared/dist", "coverage"].map((path) =>
    rm(path, { recursive: true, force: true })
  )
);
