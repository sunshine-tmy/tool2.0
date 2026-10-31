import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { utilityProcess } from "electron";
import { afterEach, expect, it, vi } from "vitest";
import { createRuntimeLayout } from "@toolbox/runtime-core";
import { DesktopDataBackup, createBackupHelper, type HelperRunner } from "./data-backup";
vi.mock("electron", () => ({ utilityProcess: { fork: vi.fn() } }));
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (
      !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(root).startsWith("toolbox-backup-main-")
    )
      throw new Error("unsafe cleanup");
    await fs.rm(root, { recursive: true, force: true });
  }
});
async function setup(helper: HelperRunner = async () => ({})) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-backup-main-"));
  roots.push(root);
  const layout = createRuntimeLayout({
    appRoot: root,
    configRoot: path.join(root, "config"),
    storageRoot: path.join(root, "data")
  });
  const events: string[] = [];
  const flow = {
    layout,
    withBackendStopped: async <T>(
      action: () => Promise<T>,
      options?: { afterRestart?: (result: T) => Promise<void> }
    ) => {
      events.push("stop");
      const result = await action();
      events.push("restart");
      await options?.afterRestart?.(result);
      return result;
    }
  };
  return { root, events, flow, backup: new DesktopDataBackup(flow, helper) };
}
it("restarts the backend after snapshot and before packaging; persists completion across controller restarts", async () => {
  const commands: string[] = [];
  const fixture = await setup(async (command) => {
    commands.push(command.action);
    return {};
  });
  await fixture.backup.initialize();
  const id = await fixture.backup.export(
    { modules: ["image-ai"], clientPreferences: { "archive.view": "list" } },
    "chosen.zip"
  );
  await vi.waitFor(async () => expect((await fixture.backup.state()).operations[0].status).toBe("completed"));
  expect(commands).toEqual(["recover", "snapshot", "pack"]);
  expect(fixture.events).toEqual(["stop", "restart"]);
  const restored = new DesktopDataBackup(fixture.flow, async () => ({}));
  await restored.initialize();
  expect((await restored.state()).operations[0]).toMatchObject({
    id,
    status: "completed",
    preferences: { "archive.view": "list" }
  });
});
it("serializes operations and cooperatively cancels the current helper", async () => {
  const fixture = await setup(async (command, signal) => {
    if (command.action !== "snapshot") return {};
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), { once: true })
    );
  });
  await fixture.backup.initialize();
  const id = await fixture.backup.export({ modules: ["speech"] }, "chosen.zip");
  await expect(fixture.backup.export({ modules: ["speech"] }, "other.zip")).rejects.toThrow("正在进行");
  await fixture.backup.cancel(id);
  await vi.waitFor(async () => expect((await fixture.backup.state()).operations[0].status).toBe("canceled"));
});
it("returns opaque selections and rejects expired/unknown plans before maintenance", async () => {
  const fixture = await setup(async (command) =>
    command.action === "inspect" ? [{ id: "speech", records: 1, files: 1, bytes: 1, expired: 0 }] : {}
  );
  const selection = await fixture.backup.select(path.join(fixture.root, "private directory", "backup.zip"));
  expect(selection).toMatchObject({ displayName: "backup.zip" });
  expect(JSON.stringify(selection)).not.toContain(fixture.root);
  await expect(fixture.backup.preview("unknown", ["speech"], "merge")).rejects.toThrow("失效");
  await expect(fixture.backup.restore(crypto.randomUUID())).rejects.toThrow("失效");
  expect(fixture.events).toEqual([]);
});
it("marks interrupted operations as requiring inspection and runs recovery before exposing state", async () => {
  const fixture = await setup();
  await fs.mkdir(fixture.backup.root, { recursive: true });
  const id = crypto.randomUUID();
  await fs.writeFile(
    path.join(fixture.backup.root, "operations.json"),
    JSON.stringify([{ id, type: "import", status: "running", cancelable: true }])
  );
  await fixture.backup.initialize();
  expect((await fixture.backup.state()).operations[0]).toMatchObject({ id, status: "failed", cancelable: false });
  await expect(fixture.backup.deletePoint("../../data")).rejects.toThrow("无效");
});
it("exposes cancellable preflight progress without publishing an unfinished file selection", async () => {
  const fixture = await setup(async (_command, signal, progress) => {
    progress({ phase: "检查摘要", files: 1, totalFiles: 3, bytes: 5, totalBytes: 15 });
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), { once: true })
    );
  });
  const selected = fixture.backup.select("chosen.zip");
  const state = await fixture.backup.state();
  expect(state.preflight).toMatchObject({ phase: "检查摘要", bytes: 5, cancelable: true });
  await expect(fixture.backup.export({ modules: ["speech"] }, "other.zip")).rejects.toThrow("正在进行");
  await fixture.backup.cancel(state.preflight!.id);
  await expect(selected).rejects.toThrow("用户取消");
  expect((await fixture.backup.state()).preflight).toBeUndefined();
});
it("keeps invalid restore points visible for explicit deletion and cleans only its temporary work", async () => {
  const fixture = await setup();
  const id = crypto.randomUUID();
  const point = path.join(fixture.backup.root, "restore-points", id);
  await fs.mkdir(point, { recursive: true });
  await fs.writeFile(path.join(point, "manifest.json"), "invalid");
  await fs.mkdir(path.join(fixture.backup.root, "work", "old"), { recursive: true });
  await fixture.backup.initialize();
  expect((await fixture.backup.state()).restorePoints[0]).toMatchObject({
    id,
    problem: expect.stringContaining("保留")
  });
  await expect(fs.stat(path.join(fixture.backup.root, "work"))).rejects.toMatchObject({ code: "ENOENT" });
  await fixture.backup.deletePoint(id);
  expect((await fixture.backup.state()).restorePoints).toEqual([]);
});
it("waits for helper exit after its result and forwards progress/cancellation on fixed messages", async () => {
  const fixture = await setup(),
    child = Object.assign(new EventEmitter(), {
      postMessage: vi.fn(),
      kill: vi.fn(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter()
    });
  vi.mocked(utilityProcess.fork).mockReturnValue(child as unknown as ReturnType<typeof utilityProcess.fork>);
  const controller = new AbortController(),
    progress = vi.fn(),
    id = crypto.randomUUID();
  const finished = vi.fn();
  const promise = createBackupHelper(fixture.flow.layout, "fixed-helper.js", "0.1.9")(
    { action: "inspect", id },
    controller.signal,
    progress
  ).then(finished);
  child.emit("message", { type: "ready" });
  expect(child.postMessage).toHaveBeenCalledWith({ type: "run", command: { action: "inspect", id } });
  child.emit("message", { type: "progress", phase: "检查", files: 1 });
  expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: "检查" }));
  controller.abort();
  expect(child.postMessage).toHaveBeenLastCalledWith({ type: "cancel" });
  child.emit("message", { type: "result", result: { ok: true } });
  await Promise.resolve();
  expect(finished).not.toHaveBeenCalled();
  child.emit("exit", 0);
  await promise;
  expect(finished).toHaveBeenCalledWith({ ok: true });
});
it("rejects helper failures even if exit is successful, retaining its cancellation classification", async () => {
  const fixture = await setup(),
    child = Object.assign(new EventEmitter(), { postMessage: vi.fn(), kill: vi.fn() });
  vi.mocked(utilityProcess.fork).mockReturnValue(child as unknown as ReturnType<typeof utilityProcess.fork>);
  const promise = createBackupHelper(fixture.flow.layout, "fixed-helper.js", "0.1.9")(
    { action: "recover", id: crypto.randomUUID() },
    new AbortController().signal,
    vi.fn()
  );
  child.emit("message", { type: "error", message: "已取消", canceled: true });
  child.emit("exit", 0);
  await expect(promise).rejects.toMatchObject({ message: "已取消", canceled: true });
});
