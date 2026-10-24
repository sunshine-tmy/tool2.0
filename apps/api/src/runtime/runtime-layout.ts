/**
 * 中文模块说明：运行时路径层，负责将可写数据、只读资源和开发源码目录显式分离。
 */
import path from "node:path";
import { createRuntimeLayout, type RuntimeLayout } from "@toolbox/runtime-core";
import { getFrontendDistRoot, getProjectRoot } from "../project-root";

// Existing API imports remain compatible; the implementation has a single Node-only owner.
export { createRuntimeLayout, resolveRuntimePath } from "@toolbox/runtime-core";
export type { RuntimeLayout } from "@toolbox/runtime-core";

/**
 * 开发、CLI 与既有脚本使用仓库布局。桌面壳会在后续阶段显式传入用户数据目录，
 * 因而不会依赖当前工作目录或 app.asar 的位置。
 */
export function createDevelopmentRuntimeLayout(options: Partial<RuntimeLayout> = {}): RuntimeLayout {
  const appRoot = normalize(options.appRoot ?? getProjectRoot());
  return createRuntimeLayout({
    appRoot,
    configRoot: options.configRoot ?? appRoot,
    storageRoot: options.storageRoot ?? path.join(appRoot, "storage"),
    runtimeRoot: options.runtimeRoot ?? path.join(appRoot, ".runtime"),
    modelsRoot: options.modelsRoot ?? path.join(appRoot, "models"),
    scriptsRoot: options.scriptsRoot ?? path.join(appRoot, "scripts"),
    frontendDistRoot: options.frontendDistRoot ?? getFrontendDistRoot(appRoot)
  });
}

function normalize(value: string) {
  return path.normalize(path.resolve(value));
}
