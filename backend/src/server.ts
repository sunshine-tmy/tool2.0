/**
 * 中文模块说明：后端应用层，负责 服务进程启动、监听和优雅退出
 */
import { createApp } from "./app";
import { getConfig } from "./config";
import { installGracefulShutdown } from "./lifecycle/graceful-shutdown";

const config = getConfig();
const app = await createApp();
// 先安装统一退出钩子，再开始监听端口，确保启动后收到 SIGINT/SIGTERM 能关闭所有资源。
installGracefulShutdown(app);

// 监听地址由部署模式决定：local 默认回环，lan 由配置显式开放给可信局域网。
await app.listen({
  host: config.host,
  port: config.port
});

console.log(`Toolbox API running at http://${config.host}:${config.port}`);
