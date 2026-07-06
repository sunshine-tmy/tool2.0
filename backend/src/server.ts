import { createApp } from "./app";
import { getConfig } from "./config";

const config = getConfig();
const app = await createApp();

await app.listen({
  host: config.host,
  port: config.port
});

console.log(`Toolbox API running at http://${config.host}:${config.port}`);
