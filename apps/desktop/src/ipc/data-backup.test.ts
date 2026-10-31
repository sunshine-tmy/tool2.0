import { afterEach, expect, it, vi } from "vitest";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { createDataBackupHandlers } from "./data-backup";
import type { DesktopDataBackup } from "../data/data-backup";
const mock = vi.hoisted(() => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("electron", () => ({ dialog: { showOpenDialog: mock.open, showSaveDialog: mock.save } }));
afterEach(() => vi.clearAllMocks());
it("validates the sender for every capability before reading local backups or showing dialogs", async () => {
  const assertTrustedSender = () => {
    throw new Error("untrusted");
  };
  const handlers = createDataBackupHandlers(
    { assertTrustedSender, getMainWindow: () => ({}) as BrowserWindow },
    {} as DesktopDataBackup
  );
  for (const handler of Object.values(handlers))
    await expect(Reflect.apply(handler, undefined, [{}])).rejects.toThrow("untrusted");
  expect(mock.open).not.toHaveBeenCalled();
  expect(mock.save).not.toHaveBeenCalled();
});
it("rejects arbitrary paths/channels and duplicate or unknown modules before requesting a save", async () => {
  const handlers = createDataBackupHandlers(
    { assertTrustedSender: () => undefined, getMainWindow: () => ({}) as BrowserWindow },
    {} as DesktopDataBackup
  );
  const event = {} as IpcMainInvokeEvent;
  for (const input of [
    { modules: ["speech"], file: "C:/user/secret" },
    { modules: ["speech", "speech"] },
    { modules: ["other"] }
  ])
    await expect(handlers.export(event, input)).rejects.toThrow();
  await expect(handlers.import(event, "../file")).rejects.toThrow();
  expect(mock.save).not.toHaveBeenCalled();
});
