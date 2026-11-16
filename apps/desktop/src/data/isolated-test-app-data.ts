import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

type DesktopAppPathPort = {
  isPackaged: boolean;
  getPath(name: "home"): string;
  setPath(name: "appData" | "cache", value: string): void;
};

/**
 * Gives explicit macOS acceptance runs an isolated Electron data root.
 * Normal launches keep Electron's default per-user paths.
 */
export function configureIsolatedTestAppDataRoot(
  app: DesktopAppPathPort,
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
) {
  const enabled = environment.TOOLBOX_ENABLE_ISOLATED_TEST_APP_DATA === "1";
  const requestedRoot = environment.TOOLBOX_ISOLATED_TEST_APP_DATA_ROOT?.trim();
  if (!enabled && !requestedRoot) return false;
  if (!enabled || !requestedRoot) {
    throw new Error("隔离桌面验收需要同时设置显式开关和数据目录");
  }
  const sourceManaged = environment.TOOLBOX_SOURCE_MANAGED === "1";
  if ((!app.isPackaged && !sourceManaged) || platform !== "darwin") {
    throw new Error("隔离桌面数据目录仅允许用于 macOS 打包或受管源码验收进程");
  }
  if (!path.isAbsolute(requestedRoot)) {
    throw new Error("隔离桌面验收数据目录必须是绝对路径");
  }

  const appDataRoot = realPathWithMissingTail(requestedRoot);
  const userHome = realPathWithMissingTail(app.getPath("home"));
  const relative = path.relative(userHome, appDataRoot);
  const isInsideUserHome =
    relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
  if (isInsideUserHome) {
    throw new Error("隔离桌面验收数据目录必须位于当前用户主目录之外");
  }

  app.setPath("appData", appDataRoot);
  app.setPath("cache", path.join(appDataRoot, "cache"));
  return true;
}

function realPathWithMissingTail(value: string) {
  let current = path.resolve(value);
  const missingTail: string[] = [];
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    missingTail.unshift(path.basename(current));
    current = parent;
  }
  return path.join(realpathSync(current), ...missingTail);
}
