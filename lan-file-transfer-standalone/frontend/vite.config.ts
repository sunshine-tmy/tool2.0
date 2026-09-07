import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const apiPort = Number(process.env.API_PORT || env.API_PORT) || 3110;
  const webPort = Number(process.env.LAN_TRANSFER_WEB_PORT || env.LAN_TRANSFER_WEB_PORT) || 5183;
  const proxy = {
    "/api": {
      target: `http://127.0.0.1:${apiPort}`,
      changeOrigin: true
    }
  };

  return {
    envDir: projectRoot,
    plugins: [vue()],
    resolve: {
      alias: {
        "@toolbox/shared": fileURLToPath(new URL("../packages/shared/src/index.ts", import.meta.url))
      }
    },
    server: { host: "0.0.0.0", port: webPort, strictPort: true, proxy },
    preview: { host: "0.0.0.0", port: webPort, strictPort: true, proxy }
  };
});
