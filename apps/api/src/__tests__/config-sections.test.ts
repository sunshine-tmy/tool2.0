/** Flat AppConfig remains compatible across internal section boundaries. */
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { getConfig } from "../config";
import { createRuntimeLayout } from "../runtime/runtime-layout";

const root = path.join(os.tmpdir(), "config-sections-中文 空格");
const layout = createRuntimeLayout({ appRoot: root, configRoot: path.join(root, "settings") });
const base = { layout, dotenvPath: false as const };

it("keeps explicit roots, flat values and the original test database default", () => {
  const value = getConfig({ ...base, environment: { NODE_ENV: "test" } });
  expect(value.runtime).toBe(layout);
  expect(value.databasePath).toBe(":memory:");
  expect(value.storageRoot).toBe(layout.storageRoot);
  expect(value.imageAiOutputsDir).toBe(path.join(layout.storageRoot, "image-ai", "outputs"));
  expect(value.edgeTtsTasksDir).toBe(path.join(layout.storageRoot, "edge-tts", "tasks"));
  expect(value.xhsTranslationModelDir).toBe(path.join(layout.runtimeRoot, "xhs-translate", "model"));
  expect(value).toMatchObject({
    port: 3100,
    host: "127.0.0.1",
    imageAiRetentionHours: 24,
    edgeTtsRetentionDays: 3,
    chatterboxRetentionDays: 3,
    deploymentUsage: "commercial"
  });
});

it("keeps relative overrides rooted in configRoot and LAN/worker normalization", () => {
  const value = getConfig({
    ...base,
    environment: {
      STORAGE_ROOT: "自定义 数据",
      DATABASE_PATH: "db/toolbox.db",
      DEPLOYMENT_MODE: " LAN ",
      ADMIN_PIN: " test-pin ",
      API_PORT: "3201",
      LAN_TRANSFER_GUEST_MODE: " UPLOAD-ONLY ",
      IMAGE_AI_WORKER_URL: "http://localhost:3211/ignored?query=1",
      XHS_TRANSLATION_RUNTIME_DIR: "translate",
      CORS_ORIGINS: "https://shop.test/path,https://shop.test/other,http://localhost:5173"
    }
  });
  expect(value.storageRoot).toBe(path.join(layout.configRoot, "自定义 数据"));
  expect(value.databasePath).toBe(path.join(layout.configRoot, "db", "toolbox.db"));
  expect(value.xhsTranslationModelDir).toBe(path.join(layout.configRoot, "translate", "model"));
  expect(value).toMatchObject({
    host: "0.0.0.0",
    port: 3201,
    adminPin: "test-pin",
    lanTransferGuestMode: "upload-only",
    imageAiWorkerUrl: "http://localhost:3211"
  });
  expect(value.corsOrigins).toEqual(["https://shop.test", "http://localhost:5173"]);
});

it("keeps managed capability paths isolated while retaining non-runtime settings", () => {
  const value = getConfig({
    ...base,
    desktopManagedCapabilities: true,
    environment: {
      STORAGE_ROOT: "ignored",
      DATABASE_PATH: "ignored.db",
      EDGE_TTS_PYTHON: "ignored.exe",
      IMAGE_AI_WORKER_URL: "http://remote.test",
      IMAGE_AI_WORKER_TOKEN: "ignored",
      CHATTERBOX_WORKER_TOKEN: "ignored",
      IMAGE_AI_RETENTION_HOURS: "48",
      CHATTERBOX_RETENTION_DAYS: "7",
      API_PORT: "3205"
    }
  });
  expect(value.storageRoot).toBe(layout.storageRoot);
  expect(value.databasePath).toBe(path.join(layout.storageRoot, "toolbox.db"));
  expect(value.imageAiWorkerUrl).toBe("http://127.0.0.1:1");
  expect(value.chatterboxWorkerUrl).toBe("http://127.0.0.1:1");
  expect(value.imageAiWorkerToken).toBeUndefined();
  expect(value.chatterboxWorkerToken).toBeUndefined();
  expect(value.edgeTtsPythonPath).toBe("");
  expect(value).toMatchObject({ imageAiRetentionHours: 48, chatterboxRetentionDays: 7, port: 3205 });
});

it.each([
  [{ DEPLOYMENT_MODE: "wrong", API_PORT: "bad" }, "DEPLOYMENT_MODE must be local or lan"],
  [{ API_PORT: "bad", IMAGE_AI_QUEUE_LIMIT: "bad" }, "API_PORT must be an integer"],
  [{ LAN_TRANSFER_GUEST_MODE: "wrong", XHS_PROVIDER_PORT: "bad" }, "LAN_TRANSFER_GUEST_MODE must be"],
  [{ XHS_PROVIDER_PORT: "bad", IMAGE_AI_WORKER_URL: "https://localhost" }, "XHS_PROVIDER_PORT must be an integer"],
  [
    { IMAGE_AI_WORKER_URL: "https://localhost", EDGE_TTS_TIMEOUT_MS: "bad" },
    "IMAGE_AI_WORKER_URL must be an http loopback URL"
  ]
])("preserves first-error precedence across sections %j", (environment, message) => {
  expect(() => getConfig({ ...base, environment })).toThrow(message);
});
