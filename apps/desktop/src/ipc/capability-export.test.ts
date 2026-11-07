import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { createRuntimeLayout } from "@toolbox/runtime-core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ saveDialog: vi.fn(), save: vi.fn() }));
vi.mock("electron", () => ({ dialog: { showSaveDialog: mocks.saveDialog } }));
vi.mock("../data/capability-export", () => ({ saveCapabilityExport: mocks.save }));
import { createCapabilityExportHandlers } from "./capability-export";
let root: string;
beforeEach(async () => {
  vi.clearAllMocks();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-ipc-export-"));
  mocks.saveDialog.mockResolvedValue({ canceled: true });
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-ipc-export-"))
    throw new Error("测试清理越界");
  await fs.rm(root, { recursive: true, force: true });
});
function setup() {
  const layout = createRuntimeLayout({ appRoot: root, configRoot: path.join(root, "config") });
  const trusted = {} as IpcMainInvokeEvent;
  const handlers = createCapabilityExportHandlers({
    layout,
    getBackendOrigin: () => "http://127.0.0.1:1234",
    getMainWindow: () => ({}) as BrowserWindow,
    assertTrustedSender(event) {
      if (event !== trusted) throw new Error("untrusted");
    }
  });
  return { layout, trusted, ...handlers };
}
it("validates sender and fixed capability IDs before opening a dialog", async () => {
  const s = setup();
  await expect(s.export({} as IpcMainInvokeEvent, "edge-tts")).rejects.toThrow("untrusted");
  await expect(s.cancel({} as IpcMainInvokeEvent)).rejects.toThrow("untrusted");
  await expect(s.export(s.trusted, "../anything")).rejects.toThrow("标识无效");
  expect(mocks.saveDialog).not.toHaveBeenCalled();
});
it("cancelling the save dialog performs no export", async () => {
  const s = setup();
  await expect(s.export(s.trusted, "edge-tts")).resolves.toEqual({ canceled: true });
  expect(mocks.save).not.toHaveBeenCalled();
});
it("restricts output to the native selection outside runtime and business directories", async () => {
  const s = setup();
  for (const directory of [s.layout.storageRoot, s.layout.runtimeRoot, s.layout.modelsRoot]) {
    await fs.mkdir(directory, { recursive: true });
    mocks.saveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: path.join(directory, "test.toolbox-capabilities.zip")
    });
    await expect(s.export(s.trusted, "edge-tts")).rejects.toThrow("目录之外");
  }
  mocks.saveDialog.mockResolvedValueOnce({ canceled: false, filePath: path.join(root, "test.zip") });
  await expect(s.export(s.trusted, "edge-tts")).rejects.toThrow("后缀");
  expect(mocks.save).not.toHaveBeenCalled();
});
it("allows only one export and cancels its stream through the fixed method", async () => {
  const s = setup();
  const destination = path.join(root, "test.toolbox-capabilities.zip");
  mocks.saveDialog.mockResolvedValue({ canceled: false, filePath: destination });
  mocks.save.mockImplementationOnce(
    (_origin, _id, _file, signal: AbortSignal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true })
      )
  );
  const exporting = s.export(s.trusted, "edge-tts");
  await vi.waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  await expect(s.export(s.trusted, "ffmpeg")).rejects.toThrow("正在导出");
  await s.cancel(s.trusted);
  await expect(exporting).resolves.toEqual({ canceled: true });
  mocks.save.mockResolvedValue({ fileName: path.basename(destination), bytes: 100 });
  await expect(s.export(s.trusted, "edge-tts")).resolves.toMatchObject({ canceled: false, bytes: 100 });
});
