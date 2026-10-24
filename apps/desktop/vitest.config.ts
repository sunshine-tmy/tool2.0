import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@toolbox/shared/desktop": fileURLToPath(new URL("../../packages/shared/src/desktop/types.ts", import.meta.url)),
      "@toolbox/runtime-core": fileURLToPath(new URL("../../packages/runtime-core/src/index.ts", import.meta.url))
    }
  }
});
