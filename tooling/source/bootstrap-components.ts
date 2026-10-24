/** 内部固定能力初始化入口，不提供任意命令、文件或 URL 参数。 */
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { getSourceConfig } from "../../apps/api/src/runtime/source-config";
import { prepareSourceComponents } from "../../apps/api/src/runtime/source-bootstrap";
import { ComponentManager } from "../../apps/api/src/modules/components/component-manager";
import { bundledComponentCatalogForRuntime } from "../../apps/api/src/modules/components/catalog";
import { createDesktopComponentSelfTest } from "../../apps/api/src/modules/components/desktop-component-self-test";
import { createSourceOfflineInstaller } from "../../apps/api/src/runtime/source-offline-resources";

if (process.argv.slice(2).some((arg) => arg !== "--with-cuda") || process.argv.length > 3)
  throw new Error("初始化入口只接受可选的 --with-cuda 参数");
if (process.platform !== "win32" || process.arch !== "x64") throw new Error("一键初始化仅支持 Windows x64");
const config = getSourceConfig();
if (!config.desktopManagedCapabilities) throw new Error("请通过 start.bat 运行受管源码初始化");
// Never modify packages under a running API (including queued tasks/playback with unknown state).
const requireFrontend = createRequire(path.join(config.runtime.appRoot, "apps/web/package.json"));
const vite = await import(pathToFileURL(requireFrontend.resolve("vite")).href);
const env = vite.loadEnv("development", config.runtime.configRoot, "VITE_");
const frontendPort = Number(env.VITE_DEV_PORT || 5173);
if (!Number.isInteger(frontendPort) || frontendPort < 1 || frontendPort > 65535) throw new Error("前端端口无效");
for (const port of [config.port, frontendPort]) {
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`端口 ${port} 已被使用；请先正常停止服务再初始化，不会终止未知进程`)));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
  });
}
const catalog = bundledComponentCatalogForRuntime();
const manager = new ComponentManager({
  root: path.join(config.runtime.runtimeRoot, "packages"),
  catalog,
  selfTest: createDesktopComponentSelfTest(),
  downloadArchive: async () => {
    throw new Error("源码启动仅使用本地能力包，不自动联网下载");
  }
});
try {
  const withCuda = process.argv.includes("--with-cuda");
  const install = await createSourceOfflineInstaller(
    manager,
    catalog,
    path.join(config.runtime.appRoot, "offline-resources", "components"),
    console.log,
    withCuda
  );
  await prepareSourceComponents(manager, console.log, undefined, undefined, withCuda, install);
  console.log("基础能力已安装；尚未测试外部语音服务、平台登录或真实素材生成。");
} catch (error) {
  // Only the fixed bootstrap summary is shown, not an irrelevant stack of source paths.
  console.error(error instanceof Error ? error.message : "能力初始化失败，请运行诊断");
  process.exitCode = 1;
}
