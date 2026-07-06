import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@toolbox/shared/video-text": fileURLToPath(new URL("../packages/shared/src/video-text.ts", import.meta.url)),
      "@toolbox/shared": fileURLToPath(new URL("../packages/shared/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node"
  }
});
