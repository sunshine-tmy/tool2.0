/**
 * 中文模块说明：项目工程文件，负责 frontend/vite.config.ts
 */
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";
import { getConfig } from "../backend/src/config";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, "VITE_");
  const apiProxy = {
    "/api": {
      target: env.VITE_API_PROXY_TARGET?.trim() || `http://127.0.0.1:${getConfig().port}`,
      changeOrigin: true,
      // 保留真正的前端连接来源；后端只放行整个转发链均为回环的诊断请求。
      xfwd: true
    }
  };
  return {
    envDir: repositoryRoot,
    build: {
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("@sinclair/typebox")) return "schema-runtime";
          }
        }
      }
    },
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@toolbox/shared/video-text": fileURLToPath(new URL("../packages/shared/src/video-text.ts", import.meta.url)),
        "@toolbox/shared": fileURLToPath(new URL("../packages/shared/src/index.ts", import.meta.url))
      }
    },
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      strictPort: true,
      host: env.VITE_DEV_HOST?.trim() || "127.0.0.1",
      proxy: apiProxy
    },
    preview: {
      proxy: apiProxy
    }
  };
});
