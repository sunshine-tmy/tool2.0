import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT || 33100);
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT || 35173);
const storageRoot = path.join(os.tmpdir(), `toolbox-playwright-${process.pid}`);
const defaultChromePath =
  process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || defaultChromePath;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ...(executablePath && fs.existsSync(executablePath) ? { launchOptions: { executablePath } } : {})
  },
  webServer: [
    {
      command: "pnpm --filter backend exec tsx src/server.ts",
      url: `http://127.0.0.1:${apiPort}/health/live`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "test",
        API_HOST: "127.0.0.1",
        API_PORT: String(apiPort),
        STORAGE_ROOT: storageRoot,
        DATABASE_PATH: path.join(storageRoot, "toolbox.db"),
        DEPLOYMENT_MODE: "local",
        LAN_TRANSFER_GUEST_MODE: "full",
        CORS_ORIGINS: `http://127.0.0.1:${webPort}`,
        EDGE_TTS_PYTHON: path.join(storageRoot, "missing-edge-tts-python.exe")
      }
    },
    {
      command: `pnpm --filter frontend exec vite --host 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}/`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`
      }
    }
  ]
});
