import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Give the existing source launcher a genuinely separate runtime/config root.
// Its normal ownership lock remains enforced; the user's running instance is never stopped or reused.
const isolatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "toolbox-ui-v2-"));

// Isolated test storage/ports come from the existing runner; no screenshots or recorded media.
export default defineConfig({
  ...base,
  webServer: (Array.isArray(base.webServer) ? base.webServer : []).map((server, index) =>
    index === 0 ? { ...server, env: { ...server.env, TOOLBOX_LEGACY_DATA_ROOT: isolatedRoot } } : server
  ),
  testMatch: ["ui-v2.spec.ts", "r08-feature-flow.spec.ts"],
  use: { ...base.use, screenshot: "off", trace: "off", video: "off" }
});
