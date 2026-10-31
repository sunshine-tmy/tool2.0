/** Exercise the real fixed helper entry/handshake with an isolated parent port and a controlled domain service. */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRuntimeLayout } from "@toolbox/runtime-core";
const mock = vi.hoisted(() => ({
  snapshot: vi.fn(),
  inspect: vi.fn(),
  preview: vi.fn(),
  restore: vi.fn(),
  pack: vi.fn(),
  recover: vi.fn(),
  read: vi.fn()
}));
vi.mock("../system/data-backup/service", () => ({
  snapshot: mock.snapshot,
  inspectPackage: mock.inspect,
  previewImport: mock.preview,
  restoreImport: mock.restore,
  packBundle: mock.pack,
  recoverRestores: mock.recover,
  readJson: mock.read
}));
let root: string, oldLayout: string | undefined;
const oldPort = Object.getOwnPropertyDescriptor(process, "parentPort");
let listener: (event: { data: unknown }) => void;
const posted: Array<Record<string, unknown>> = [];
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  posted.length = 0;
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-backup-entry-"));
  oldLayout = process.env.TOOLBOX_RUNTIME_LAYOUT;
  process.env.TOOLBOX_RUNTIME_LAYOUT = JSON.stringify(
    createRuntimeLayout({ appRoot: root, configRoot: path.join(root, "config"), storageRoot: path.join(root, "data") })
  );
  Object.defineProperty(process, "parentPort", {
    configurable: true,
    value: {
      postMessage: (message: Record<string, unknown>) => posted.push(message),
      on: (_event: string, fn: typeof listener) => {
        listener = fn;
      }
    }
  });
  vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  mock.snapshot.mockResolvedValue({ manifest: { modules: [] } });
  mock.inspect.mockResolvedValue({ manifest: { modules: [] } });
  mock.preview.mockResolvedValue({ planId: crypto.randomUUID() });
  mock.restore.mockResolvedValue({});
  mock.pack.mockResolvedValue(undefined);
  mock.recover.mockResolvedValue(undefined);
  mock.read.mockImplementation(async (filename: string) =>
    filename.endsWith("manifest.json")
      ? { format: "toolbox-module-backup", version: 1, modules: [{ id: "speech" }] }
      : filename.endsWith("records.json")
        ? { id: "speech", version: 1, records: [] }
        : []
  );
  await import("../data-backup-entry");
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (oldLayout === undefined) delete process.env.TOOLBOX_RUNTIME_LAYOUT;
  else process.env.TOOLBOX_RUNTIME_LAYOUT = oldLayout;
  if (oldPort) Object.defineProperty(process, "parentPort", oldPort);
  else Reflect.deleteProperty(process, "parentPort");
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-backup-entry-")
  )
    throw new Error("unsafe cleanup");
  await fs.rm(root, { recursive: true, force: true });
});
async function send(command: Record<string, unknown>) {
  listener({ data: { type: "run", command } });
  await vi.waitFor(() =>
    expect(posted.some((message) => message.type === "result" || message.type === "error")).toBe(true)
  );
  return posted.find((message) => message.type === "result" || message.type === "error")!;
}
it.each(["recover", "snapshot", "pack", "inspect", "preview", "restore", "rollback"])(
  "executes only the fixed %s capability and cleans its own staging",
  async (action) => {
    const id = crypto.randomUUID();
    const result = await send({
      action,
      id,
      file: path.join(root, "chosen.zip"),
      selection: { modules: ["speech"] },
      modules: ["speech"],
      mode: "merge",
      planId: crypto.randomUUID(),
      restorePointId: crypto.randomUUID()
    });
    expect(posted[0]).toEqual({ type: "ready" });
    expect(result.type).toBe("result");
    expect(process.exit).toHaveBeenCalledWith(0);
    if (action === "recover") expect(mock.recover).toHaveBeenCalledOnce();
    if (action === "rollback") {
      expect(mock.pack).toHaveBeenCalledOnce();
      expect(mock.preview).toHaveBeenCalledOnce();
      expect(mock.restore).toHaveBeenCalledOnce();
    }
    if (action === "snapshot") expect(mock.snapshot.mock.calls[0][0].config.desktopManagedCapabilities).toBe(true);
    if (action !== "snapshot" && action !== "preview")
      await expect(fs.stat(path.join(root, "module-backups", "work", id))).rejects.toMatchObject({ code: "ENOENT" });
  }
);
it.each([
  { action: "unknown" },
  { action: "snapshot" },
  { action: "pack" },
  { action: "inspect" },
  { action: "preview", file: "test.zip", modules: ["unknown"], mode: "merge" },
  { action: "restore", planId: "../db" },
  { action: "rollback", restorePointId: "../db" }
])("rejects invalid helper arguments %j", async (input) => {
  const result = await send({ id: crypto.randomUUID(), ...input });
  expect(result.type).toBe("error");
  expect(process.exit).toHaveBeenCalledWith(1);
  expect(mock.snapshot).not.toHaveBeenCalled();
  expect(mock.restore).not.toHaveBeenCalled();
});
it("cooperatively cancels, ignores unknown messages and does not admit a second command", async () => {
  listener({ data: { type: "ignored" } });
  listener({ data: { type: "cancel" } });
  mock.snapshot.mockImplementation(async (context) => {
    context.signal.throwIfAborted();
  });
  const result = await send({ id: crypto.randomUUID(), action: "snapshot", selection: { modules: ["speech"] } });
  expect(result).toMatchObject({ type: "error", canceled: true });
  listener({ data: { type: "run", command: { id: crypto.randomUUID(), action: "recover" } } });
  expect(mock.recover).not.toHaveBeenCalled();
});
