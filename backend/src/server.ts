/**
 * 中文模块说明：后端应用层，负责 服务进程启动、监听和优雅退出
 */
import { getConfig } from "./config";
import { startBackend } from "./bootstrap";
import { installGracefulShutdown } from "./lifecycle/graceful-shutdown";

const config = getConfig();
const backend = await startBackend({ config });
// 先安装统一退出钩子，再开始监听端口，确保启动后收到 SIGINT/SIGTERM 能关闭所有资源。
installGracefulShutdown(backend.app);

console.log(`Toolbox API running at ${backend.origin}`);
