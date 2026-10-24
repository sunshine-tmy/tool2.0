/** 应用装配兼容性：使用完整合成布局；不读取本机能力/模型或业务数据。 */
import fsp from "node:fs/promises";
import net from "node:net";
import fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { startBackend } from "../bootstrap";
import { getConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { createAppServices } from "../app/services";
import { registerAppLifecycle } from "../app/lifecycle";
import { registerSystemRoutes } from "../app/system-routes";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let app: FastifyInstance | undefined;
beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = undefined;
  await fixture.dispose();
});
function config() {
  return getConfig({
    layout: fixture.layout,
    dotenvPath: false,
    desktopManagedCapabilities: true,
    environment: { NODE_ENV: "test", CORS_ORIGINS: "http://127.0.0.1:5173" }
  });
}

it("ends an active SSE stream and subscription before worker and database close", async () => {
  const local = config();
  const services = await createAppServices(local);
  const stages: string[] = [];
  app = fastify();
  const streams = registerAppLifecycle(app, { onShutdownStage: (stage) => stages.push(stage) }, services);
  registerSystemRoutes(app, local, services.database, services.taskStore, [], streams);
  const stop = vi.fn();
  const subscribe = services.taskStore.subscribe.bind(services.taskStore);
  vi.spyOn(services.taskStore, "subscribe").mockImplementation((id, listener) => {
    const unsubscribe = subscribe(id, listener);
    return () => {
      stop();
      unsubscribe();
    };
  });
  const task = services.taskStore.create("image-compress");
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  const response = await fetch(`${origin}/api/v1/tasks/${task.id}/events`);
  const reader = response.body!.getReader();
  try {
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: task");
    expect(streams.size).toBe(1);
    await app.close();
    expect((await reader.read()).done).toBe(true);
    expect(streams.size).toBe(0);
    expect(stop).toHaveBeenCalledOnce();
    expect(stages).toEqual(["tasks", "workers", "database"]);
    expect(services.database.connection.open).toBe(false);
  } finally {
    await reader.cancel();
  }
});

it("preserves initialization stages and closes task streams/workers before the database", async () => {
  const stages: string[] = [],
    closeStages: string[] = [];
  app = await createApp({
    config: config(),
    onStage: (stage) => stages.push(stage),
    onShutdownStage: (stage) => closeStages.push(stage)
  });
  await app.ready();
  expect(stages).toEqual(["database", "storage"]);
  await app.close();
  expect(closeStages).toEqual(["tasks", "workers", "database"]);
});

it("keeps root response/security hooks on health, business and not-found routes", async () => {
  app = await createApp({ config: config() });
  for (const [url, status] of [
    ["/health/live", 200],
    ["/api/v1/tools", 200],
    ["/missing-route", 404]
  ] as const) {
    const response = await app.inject({
      url,
      headers: { origin: "http://127.0.0.1:5173", "x-request-id": "assembly-request" }
    });
    expect(response.statusCode).toBe(status);
    expect(response.headers["x-request-id"]).toBe("assembly-request");
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.json().requestId).toBe("assembly-request");
  }
  const denied = await app.inject({ url: "/api/v1/tools", headers: { origin: "http://untrusted.test" } });
  expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
});

it("retains the startup error while closing registered resources after storage preparation fails", async () => {
  const local = config(),
    failure = new Error("injected storage failure"),
    stages: string[] = [];
  const mkdir = fsp.mkdir.bind(fsp);
  vi.spyOn(fsp, "mkdir").mockImplementation((...args: Parameters<typeof fsp.mkdir>) => {
    if (String(args[0]) === local.outputDir) return Promise.reject(failure);
    return mkdir(...args);
  });
  const close = vi.spyOn(ToolboxDatabase.prototype, "close");
  await expect(createApp({ config: local, onShutdownStage: (stage) => stages.push(stage) })).rejects.toBe(failure);
  expect(stages).toEqual(["tasks", "workers", "database"]);
  expect(close).toHaveBeenCalledOnce();
});

it("closes the initialized app after an owned occupied port causes listen failure", async () => {
  const occupied = net.createServer();
  await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", resolve));
  try {
    const address = occupied.address();
    if (!address || typeof address === "string") throw new Error("Expected a local TCP port");
    const stages: string[] = [];
    await expect(
      startBackend({
        config: config(),
        host: "127.0.0.1",
        port: address.port,
        onShutdownStage: (stage) => stages.push(stage)
      })
    ).rejects.toMatchObject({ code: "EADDRINUSE" });
    expect(stages).toEqual(["tasks", "workers", "database"]);
  } finally {
    await new Promise<void>((resolve, reject) => occupied.close((error) => (error ? reject(error) : resolve())));
  }
});
