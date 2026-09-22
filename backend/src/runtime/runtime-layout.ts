/**
 * 中文模块说明：运行时路径层，负责将可写数据、只读资源和开发源码目录显式分离。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export type RuntimeLayout = {
  /** 包含脚本和开发配置的只读应用根目录。 */
  appRoot: string;
  /** 用户配置文件的默认目录。 */
  configRoot: string;
  /** SQLite、媒体和任务产物的默认根目录。 */
  storageRoot: string;
  /** 可按需安装的运行时根目录。 */
  runtimeRoot: string;
  /** 模型文件的默认根目录。 */
  modelsRoot: string;
  /** Python Worker 源码或打包 Worker 的根目录。 */
  scriptsRoot: string;
  /** 生产前端构建文件的根目录。 */
  frontendDistRoot: string;
};

export type RuntimeLayoutOptions = Partial<RuntimeLayout> & Pick<RuntimeLayout, "appRoot">;

/**
 * 开发、CLI 与既有脚本使用仓库布局。桌面壳会在后续阶段显式传入用户数据目录，
 * 因而不会依赖当前工作目录或 app.asar 的位置。
 */
export function createDevelopmentRuntimeLayout(options: Partial<RuntimeLayout> = {}): RuntimeLayout {
  const appRoot = normalize(options.appRoot ?? fileURLToPath(new URL("../../..", import.meta.url)));
  return createRuntimeLayout({
    appRoot,
    configRoot: options.configRoot ?? appRoot,
    storageRoot: options.storageRoot ?? path.join(appRoot, "storage"),
    runtimeRoot: options.runtimeRoot ?? path.join(appRoot, ".runtime"),
    modelsRoot: options.modelsRoot ?? path.join(appRoot, "models"),
    scriptsRoot: options.scriptsRoot ?? path.join(appRoot, "scripts"),
    frontendDistRoot: options.frontendDistRoot ?? path.join(appRoot, "frontend", "dist")
  });
}

export function createRuntimeLayout(options: RuntimeLayoutOptions): RuntimeLayout {
  const appRoot = normalize(options.appRoot);
  return {
    appRoot,
    configRoot: normalize(options.configRoot ?? appRoot),
    storageRoot: normalize(options.storageRoot ?? path.join(appRoot, "storage")),
    runtimeRoot: normalize(options.runtimeRoot ?? path.join(appRoot, ".runtime")),
    modelsRoot: normalize(options.modelsRoot ?? path.join(appRoot, "models")),
    scriptsRoot: normalize(options.scriptsRoot ?? path.join(appRoot, "scripts")),
    frontendDistRoot: normalize(options.frontendDistRoot ?? path.join(appRoot, "frontend", "dist"))
  };
}

/** 仅允许配置中的相对路径以显式基准目录展开。 */
export function resolveRuntimePath(base: string, value: string) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(base, value);
}

function normalize(value: string) {
  return path.normalize(path.resolve(value));
}
