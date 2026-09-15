/**
 * 中文模块说明：后端应用层，负责 服务进程启动、监听和优雅退出
 */
import { createApp } from "./app";
import { getConfig } from "./config";
import { installGracefulShutdown } from "./lifecycle/graceful-shutdown";

const config = getConfig();
const app = await createApp();
installGracefulShutdown(app);

await app.listen({
  host: config.host,
  port: config.port
});

console.log(`Toolbox API running at http://${config.host}:${config.port}`);
