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
