/** Read-only resources and writable data are explicit; importing this module performs no I/O. */
import path from "node:path";

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

type RuntimeLayoutOptions = Partial<RuntimeLayout> & Pick<RuntimeLayout, "appRoot">;

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
