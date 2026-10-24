/**
 * 中文模块说明：项目工程文件，负责 frontend/vite.config.ts
 */
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";
import { resolveApiProxyTarget } from "./tooling/dev-config";
import { compactStyleLayers } from "./tooling/style-layers";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, "VITE_");
  const apiProxy = {
    "/api": {
      target: resolveApiProxyTarget(repositoryRoot, env),
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
    css: { postcss: { plugins: [compactStyleLayers()] } },
    resolve: {
      alias: {
        "@toolbox/shared/common": fileURLToPath(new URL("../../packages/shared/src/common/index.ts", import.meta.url)),
        "@toolbox/shared/system": fileURLToPath(new URL("../../packages/shared/src/system/index.ts", import.meta.url)),
        "@toolbox/shared/speech": fileURLToPath(new URL("../../packages/shared/src/speech/index.ts", import.meta.url)),
        "@toolbox/shared/archive": fileURLToPath(
          new URL("../../packages/shared/src/archive/index.ts", import.meta.url)
        ),
        "@toolbox/shared/lan": fileURLToPath(new URL("../../packages/shared/src/lan/index.ts", import.meta.url)),
        "@toolbox/shared/audio-library": fileURLToPath(
          new URL("../../packages/shared/src/audio-library/index.ts", import.meta.url)
        ),
        "@toolbox/shared/image": fileURLToPath(new URL("../../packages/shared/src/image/index.ts", import.meta.url)),
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@toolbox/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
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
