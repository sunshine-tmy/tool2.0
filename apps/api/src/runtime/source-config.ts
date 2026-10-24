/** 源码一键入口复用签名能力运行时，但保留开发版数据、数据库及网络配置。 */
import { getConfig } from "../config";
import fs from "node:fs/promises";
import path from "node:path";

export function getSourceConfig(options: Parameters<typeof getConfig>[0] = {}) {
  const base = getConfig(options);
  const environment = options.environment ?? process.env;
  if (environment.TOOLBOX_SOURCE_MANAGED !== "1") return base;
  const managed = getConfig({
    ...options,
    layout: { ...base.runtime, storageRoot: base.storageRoot },
    desktopManagedCapabilities: true
  });
  managed.databasePath = base.databasePath;
  return managed;
}

/** Windows 独占 FileShare.None 启动锁也阻止其他终端绕过入口并行启动旧源码 API。 */
export async function assertSourceStartupAvailable(config: ReturnType<typeof getConfig>) {
  if (config.desktopManagedCapabilities || process.platform !== "win32") return;
  try {
    const handle = await fs.open(path.join(config.runtime.runtimeRoot, "bootstrap", "launcher.lock"), "r");
    await handle.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new Error("一键初始化/受管实例正在运行或启动锁不可访问，请先正常关闭该实例，不要并行启动源码 API");
  }
}
