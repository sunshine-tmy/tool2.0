/** Compatibility ownership guards; synthetic tasks, an in-memory database and an isolated empty runtime only. */
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ContentArchiveTask } from "@toolbox/shared";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore } from "../tasks/task-store";
import { XhsArchiveStore } from "../domains/content-archive/compat/xhs/store";
import { XhsArchiveTaskService } from "../domains/content-archive/compat/xhs/task-service";
import { registerXhsArchiveRoutes } from "../domains/content-archive/routes";
import {
  XhsTranslationService,
  translationSourceHash
} from "../domains/content-archive/compat/xhs/translation-service";
import { ContentArchiveStore } from "../domains/content-archive/core/store";
import { ContentArchiveTaskService } from "../domains/content-archive/core/task-service";
import { ContentArchiveTranslationService } from "../domains/content-archive/core/translation-service";
import { archiveTranslationSourceHash } from "../domains/content-archive/core/text";
import { XhsRuntimeManager } from "../domains/content-archive/providers/xiaohongshu/runtime";
import { XhsAuthManager } from "../domains/content-archive/providers/xiaohongshu/auth";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let store: XhsArchiveStore;
let app: FastifyInstance | undefined;
beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
  store = new XhsArchiveStore(config, database);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request in compatibility test")));
});
afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  database?.close();
  await fixture?.dispose();
});
function service(shutdown = vi.fn()) {
  return new XhsArchiveTaskService(
    config,
    vi.fn().mockRejectedValue(new Error("Unexpected remote request")),
    store,
    new XhsRuntimeManager(config),
    new XhsAuthManager(config),
    { enqueue: vi.fn(), recoverInterrupted: vi.fn(), shutdown },
    createTaskStore(1000, database),
    database
  );
}
function task(platform: ContentArchiveTask["platform"], errorCode = "ARCHIVE_QUEUE_FULL"): ContentArchiveTask {
  return {
    id: "synthetic_123456",
    platform,
    status: "failed",
    stage: "failed",
    progress: 0,
    message: "synthetic failure",
    errorCode,
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z"
  };
}
it("keeps one core store and the existing translation subclass and exact hash alias", () => {
  expect(store.content).toBeInstanceOf(ContentArchiveStore);
  expect(Object.getPrototypeOf(XhsTranslationService.prototype)).toBe(ContentArchiveTranslationService.prototype);
  expect(translationSourceHash).toBe(archiveTranslationSourceHash);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
it.each(["ARCHIVE_QUEUE_FULL", "XHS_PARSE_FAILED", "UNRELATED"])(
  "projects only the existing error prefix for %s without mutating the core task",
  (errorCode) => {
    const owner = service();
    const value = task("xiaohongshu", errorCode);
    const before = structuredClone(value);
    vi.spyOn(owner.content, "get").mockReturnValue(value);
    const projected = owner.get(value.id);
    expect(projected).toEqual({ ...value, platform: undefined, errorCode: errorCode.replace(/^ARCHIVE_/, "XHS_") });
    expect(projected).not.toHaveProperty("platform");
    expect(value).toEqual(before);
  }
);
it("does not expose a Douyin task through the legacy task view", () => {
  const owner = service();
  vi.spyOn(owner.content, "get").mockReturnValue(task("douyin"));
  expect(owner.get("synthetic_123456")).toBeUndefined();
});
it("keeps whole-store maintenance explicit while normal missing-item removal does not reach the core", async () => {
  vi.spyOn(store.content, "get").mockResolvedValue(undefined);
  const remove = vi.spyOn(store.content, "remove");
  const purge = vi.spyOn(store.content, "purgeAll").mockResolvedValue(0);
  expect(await store.remove("missing_123456")).toBe(false);
  expect(remove).not.toHaveBeenCalled();
  await store.purgeAll();
  expect(purge).toHaveBeenCalledOnce();
});
it("shuts translation down even when the shared task owner fails to close", async () => {
  const shutdown = vi.fn();
  const owner = service(shutdown);
  const failure = new Error("synthetic close failure");
  vi.spyOn(owner.content, "close").mockRejectedValue(failure);
  await expect(owner.close()).rejects.toBe(failure);
  expect(shutdown).toHaveBeenCalledOnce();
});
it("keeps initialization, same-instance route registration and reversed Fastify close order", async () => {
  const trace: string[] = [];
  vi.spyOn(ContentArchiveTaskService.prototype, "initialize").mockImplementation(async () => {
    trace.push("tasks.initialize");
  });
  vi.spyOn(ContentArchiveTranslationService.prototype, "recoverInterrupted").mockImplementation(async () => {
    trace.push("translation.recover");
  });
  vi.spyOn(ContentArchiveTaskService.prototype, "close").mockImplementation(async () => {
    trace.push("tasks.close");
  });
  vi.spyOn(ContentArchiveTranslationService.prototype, "shutdown").mockImplementation(async () => {
    trace.push("translation.shutdown");
  });
  const auth = new XhsAuthManager(config);
  vi.spyOn(auth, "stop").mockImplementation(async () => {
    trace.push("auth.stop");
  });
  app = Fastify();
  const instance = app;
  const routeOwners: FastifyInstance[] = [];
  const routes: string[] = [];
  app.addHook("onRoute", function (options) {
    if (options.method === "HEAD") return;
    trace.push("route");
    routes.push(`${options.method} ${options.url}`);
    routeOwners.push(this);
  });
  await registerXhsArchiveRoutes({
    app,
    config,
    database,
    taskStore: createTaskStore(1000, database),
    remoteFetch: vi.fn(),
    store,
    auth
  });
  expect(trace.slice(0, 3)).toEqual(["tasks.initialize", "translation.recover", "route"]);
  expect(routeOwners.every((owner) => owner === instance)).toBe(true);
  const legacy = routes.indexOf("GET /api/v1/tools/xhs-archive/runtime");
  expect(legacy).toBeGreaterThan(0);
  expect(routes.slice(0, legacy).every((route) => route.includes("/tools/media-archive/"))).toBe(true);
  expect(routes.slice(legacy).every((route) => route.includes("/tools/xhs-archive/"))).toBe(true);
  expect(routes.slice(-2)).toEqual([
    "POST /api/v1/tools/xhs-archive/auth/start",
    "GET /api/v1/tools/xhs-archive/auth/:sessionId"
  ]);
  trace.length = 0;
  await app.close();
  expect(trace).toEqual(["auth.stop", "tasks.close", "translation.shutdown"]);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
