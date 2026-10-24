/** R11 local visual evidence only; the normal E2E suite never requires local screenshots. */
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const port = 35175;
export default defineConfig(base, {
  testDir: "./tooling/testing/browser",
  testMatch: "r11-style-compatibility.spec.ts",
  timeout: 240000,
  reporter: [["list"], ["json", { outputFile: "output/playwright/r11-test-results/results.json" }]],
  outputDir: "output/playwright/r11-test-results",
  use: { baseURL: `http://127.0.0.1:${port}`, locale: "zh-CN", timezoneId: "Asia/Shanghai", serviceWorkers: "block" },
  webServer: {
    command: `pnpm --filter frontend exec vite --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/`,
    timeout: 120000,
    reuseExistingServer: false,
    env: { VITE_API_BASE: "/api/v1", VITE_API_PROXY_TARGET: "http://127.0.0.1:1" }
  }
});
