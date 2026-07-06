import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ["vue", "vue-router", "pinia"],
          naive: ["naive-ui"],
          icons: ["lucide-vue-next"]
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@toolbox/shared": fileURLToPath(new URL("../packages/shared/src/index.ts", import.meta.url))
    }
  },
  server: {
    proxy: {
      "/api": "http://192.168.1.241:3100"
    }
  }
});
