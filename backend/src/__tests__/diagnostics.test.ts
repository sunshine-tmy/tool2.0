import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnosticFailure } from "@toolbox/shared";
import { getConfig } from "../config";
import { DiagnosticsService } from "../modules/diagnostics/service";
import { registerDiagnosticRoutes } from "../modules/diagnostics/routes";
import { MaintenanceGate } from "../modules/diagnostics/maintenance";
import { DiagnosticJournal } from "../runtime/diagnostic-journal";
import type { ComponentManager } from "../modules/components/component-manager";
import type { ToolboxDatabase } from "../database/toolbox-database";
import { diagnosticProcess } from "../modules/diagnostics/deep-checks";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});
async function fixture(desktop = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-diagnostics-test-"));
  roots.push(root);
  const config = getConfig({
    dotenvPath: false,
    environment: { NODE_ENV: "test", STORAGE_ROOT: root },
    desktopManagedCapabilities: false
  });
  config.desktopManagedCapabilities = desktop;
  config.storageRoot = root;
  config.tempDir = root;
  config.outputDir = root;
  const components = { list: vi.fn(async () => []), hasActiveJobs: vi.fn(() => false), verifyCurrent: vi.fn() };
  const database = { ready: vi.fn(), list: vi.fn((): Array<{ status: string }> => []) };
  const restart = vi.fn(async () => undefined);
  const service = new DiagnosticsService(
    config,
    database as unknown as ToolboxDatabase,
    components as unknown as ComponentManager,
    restart
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ protocolVersion: 1, available: true, modelLoaded: false, cudaAvailable: false }))
    )
  );
  return { root, service, components, database, restart };
}

describe("diagnostics safety and state", () => {
  it("classifies causes without exposing untrusted messages", () => {
    for (const [error, code] of [
      [{ code: "EACCES", message: "secret-token 用户文案 C:\\Users\\private" }, "ACCESS_DENIED"],
      [{ cause: { code: "ECONNREFUSED" } }, "CONNECTION_REFUSED"],
      [{ status: 403 }, "ONLINE_FORBIDDEN"],
      [{ code: "SQLITE_CANTOPEN" }, "DATABASE_UNAVAILABLE"],
      [{ message: "CUDA memory?" }, "UNKNOWN_FAILURE"]
    ] as const) {
      expect(diagnosticFailure(error).code).toBe(code);
      expect(JSON.stringify(diagnosticFailure(error))).not.toMatch(/secret-token|用户文案|Users|private/);
    }
  });
  it("does not load models or synthesize in light checks, and reports CPU fallback separately", async () => {
    const { service } = await fixture();
    const run = await service.start({ depth: "light" });
    expect(run.checks.find((c) => c.id === "worker-chatterbox")).toMatchObject({
      status: "warning",
      code: "CPU_FALLBACK"
    });
    expect(run.checks.find((c) => c.id === "online-speech")).toMatchObject({ status: "skipped" });
    for (const args of vi.mocked(fetch).mock.calls) expect(args[0].toString()).toContain("/diagnostics/light");
  });
  it("treats missing optional desktop capabilities as neutral", async () => {
    const { service, components } = await fixture(true);
    components.list.mockResolvedValue([
      { id: "chatterbox", installed: false, displayName: "克隆", taskToolIds: ["edge-tts"], purpose: "声音克隆" }
    ] as never);
    const run = await service.start({ depth: "light" });
    expect(run.checks.find((c) => c.id === "component-chatterbox")?.status).toBe("not-installed");
    expect(run.checks.some((c) => c.status === "failed")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("distinguishes unavailable database from a live process", async () => {
    const { service, database } = await fixture();
    database.ready.mockImplementation(() => {
      throw { code: "SQLITE_CANTOPEN" };
    });
    const run = await service.start({ depth: "light" });
    expect(run.checks[0].code).toBe("SERVICE_NOT_READY");
    expect(run.checks.find((c) => c.id === "database")?.code).toBe("DATABASE_UNAVAILABLE");
  });
  it("does not disguise a failed installation as an intentionally uninstalled option", async () => {
    const { service, components } = await fixture(true);
    components.list.mockResolvedValue([
      {
        id: "edge-tts",
        installed: false,
        state: "failed",
        displayName: "在线配音",
        taskToolIds: ["edge-tts"],
        purpose: "配音"
      }
    ] as never);
    const run = await service.start({ depth: "light" });
    expect(run.checks.find((c) => c.id === "component-edge-tts")).toMatchObject({
      status: "failed",
      code: "COMPONENT_INSTALL_FAILED"
    });
  });
  it("checks domain queues, not just generic tasks", async () => {
    const { service, database, restart } = await fixture(true);
    database.list.mockImplementation(((kind: string) =>
      kind === "chatterbox-item" ? [{ status: "queued" }] : []) as never);
    await expect(service.action("chatterbox")).rejects.toMatchObject({ code: "DIAGNOSTICS_BUSY" });
    expect(restart).not.toHaveBeenCalled();
  });
  it("rejects deep checks and recovery during any playback", async () => {
    const { service } = await fixture(true);
    service.setPlayback("inline", true);
    await expect(service.start({ depth: "deep", targets: ["chatterbox"], confirmed: true })).rejects.toMatchObject({
      code: "DIAGNOSTICS_BUSY"
    });
    await expect(service.action("chatterbox")).rejects.toMatchObject({ code: "DIAGNOSTICS_BUSY" });
    service.setPlayback("inline", false);
    await expect(service.action("chatterbox")).resolves.toMatchObject({ state: "completed" });
  });
  it("requires explicit confirmation and disallows arbitrary targets", async () => {
    const { service } = await fixture();
    await expect(service.start({ depth: "deep", targets: ["chatterbox"] })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED"
    });
    await expect(service.start({ depth: "deep", targets: ["https://private"], confirmed: true })).rejects.toMatchObject(
      { code: "INVALID_TARGET" }
    );
  });
  it("holds the exclusive lock while a cancelled model call reaches a safe boundary", async () => {
    const { service } = await fixture();
    let done!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          done = resolve;
        })
    );
    const run = await service.start({ depth: "deep", targets: ["chatterbox"], confirmed: true });
    expect(service.gate.locked).toBe(true);
    expect(service.cancel(run.id).phase).toContain("取消中");
    expect(service.gate.locked).toBe(true);
    expect(() => service.setPlayback("new", true)).toThrow();
    done(new Response(JSON.stringify({ protocolVersion: 1, available: true })));
    await vi.waitFor(() => expect(service.get(run.id).state).toBe("cancelled"));
    expect(service.gate.locked).toBe(false);
  });
  it("does not include sensitive errors or raw logs in either report mode", async () => {
    const { service } = await fixture();
    vi.mocked(fetch).mockRejectedValue(
      new Error("PIN=1234 Cookie=abc C:\\Users\\demo 我的中文文案 wss://x?token=secret")
    );
    const run = await service.start({ depth: "light" });
    for (const include of [false, true])
      expect(service.report(run.id, include).content).not.toMatch(/1234|Cookie|Users|中文文案|wss:|secret/);
  });
  it("does not release maintenance on HTTP timeout until the model worker reports idle", async () => {
    const { service } = await fixture();
    vi.mocked(fetch)
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { name: "TimeoutError" }))
      .mockResolvedValue(new Response(JSON.stringify({ protocolVersion: 1, available: true, busy: false })));
    const run = await service.start({ depth: "deep", targets: ["chatterbox"], confirmed: true });
    await vi.waitFor(() => expect(service.get(run.id).state).toBe("completed"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(service.get(run.id).checks[0].code).toBe("CHECK_TIMEOUT");
    expect(service.gate.locked).toBe(false);
  });
  it("refuses remote and redirecting worker diagnostics", async () => {
    const { service } = await fixture();
    service.config.chatterboxWorkerUrl = "http://192.168.1.8:3220";
    await expect(service.worker("chatterbox")).rejects.toMatchObject({ code: "WORKER_TARGET_UNSUPPORTED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not allow unknown clients or cross-origin websites to inspect diagnostics", async () => {
    const { service } = await fixture();
    const app = fastify();
    app.addHook("preSerialization", async (request, _reply, payload) => ({
      ...(payload as object),
      requestId: request.id
    }));
    registerDiagnosticRoutes(app, service);
    try {
      for (const input of [
        { remoteAddress: "192.168.1.2" },
        { headers: { origin: "https://evil.example" } },
        { headers: { "x-forwarded-for": "192.168.1.2, 127.0.0.1" } },
        { headers: { origin: "null" } },
        { headers: { origin: "http://localhost:9999", "sec-fetch-site": "cross-site" } },
        { remoteAddress: "192.168.1.2", headers: { "x-forwarded-for": "127.0.0.1", origin: "http://localhost:5173" } },
        { headers: { "x-forwarded-for": "" } },
        { headers: { "x-forwarded-for": "garbage" } }
      ])
        expect((await app.inject({ url: "/api/v1/diagnostics", ...input })).statusCode).toBe(403);
      expect((await app.inject({ url: "/api/v1/diagnostics" })).statusCode).toBe(200);
      for (const headers of [
        { "x-forwarded-for": "127.0.0.1" },
        { "x-forwarded-for": "::1, ::ffff:127.0.0.1" },
        { "x-forwarded-for": "127.0.0.2, ::ffff:7f00:1" },
        { origin: "http://localhost:5173", "sec-fetch-site": "cross-site" },
        { origin: "http://127.0.0.1:5173", "sec-fetch-site": "cross-site", "x-forwarded-for": "127.0.0.1" }
      ]) {
        expect((await app.inject({ url: "/api/v1/diagnostics", headers })).statusCode).toBe(200);
        expect(
          (
            await app.inject({
              url: "/api/v1/diagnostics/reports",
              method: "POST",
              headers,
              payload: { runId: (await service.snapshot()).id, includeEvents: false }
            })
          ).statusCode
        ).toBe(200);
      }
      expect(
        (
          await app.inject({
            url: "/api/v1/diagnostics/actions",
            method: "POST",
            payload: { action: "exec", command: "anything" }
          })
        ).statusCode
      ).toBe(400);
    } finally {
      await app.close();
    }
  });
  it("maintenance admission refuses concurrent writes and recovers after release", () => {
    const gate = new MaintenanceGate();
    gate.enterRequest("upload");
    expect(() => gate.acquire("deep")).toThrow();
    gate.leaveRequest("upload");
    const release = gate.acquire("deep");
    expect(() => gate.enterRequest("new-task")).toThrow();
    release();
    expect(() => gate.enterRequest("new-task")).not.toThrow();
  });
  it("bounded journal drops arbitrary process output and survives unwritable storage", async () => {
    const { root } = await fixture();
    const blocked = path.join(root, "not-a-directory");
    await fs.writeFile(blocked, "x");
    const journal = new DiagnosticJournal(blocked);
    journal.consume("worker", "EACCES token=secret C:/Users/demo 中文文案");
    expect(journal.events).toHaveLength(1);
    expect(JSON.stringify(journal.events)).not.toMatch(/secret|Users|中文文案/);
    for (let i = 0; i < 510; i++) journal.record("startup", "CHECK_STARTED");
    expect(journal.events).toHaveLength(500);
  });
  it("cancels diagnostic subprocesses without leaving the child running", async () => {
    const controller = new AbortController();
    const running = diagnosticProcess(process.execPath, ["-e", "setTimeout(()=>{},30000)"], controller.signal);
    controller.abort();
    await expect(running).rejects.toBeDefined();
  });
});
