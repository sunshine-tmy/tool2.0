import { createApp } from "./app";
import { getConfig } from "./config";

const config = getConfig();
const app = await createApp();

await app.listen({ host: config.host, port: config.port });
console.log(`本地图片与文件工具 API 已启动：http://${config.host}:${config.port}`);
