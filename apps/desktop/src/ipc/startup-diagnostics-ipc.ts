import path from "node:path";
import fs from "node:fs/promises";
import { app, clipboard, dialog, ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { DiagnosticJournal } from "@toolbox/runtime-core";
import type { StartupSnapshot } from "@toolbox/shared/desktop";
type StartupDiagnosticsIpcOptions = {
  dataRoot: string;
  getWindow: () => BrowserWindow | undefined;
  journal: DiagnosticJournal;
  snapshot: () => StartupSnapshot;
  summary: () => string;
  resetProgress: () => void;
  retry: () => Promise<void>;
  fail: (error: unknown) => void;
};
export function registerStartupDiagnosticsIpc(options: StartupDiagnosticsIpcOptions) {
  const trusted = (event: IpcMainInvokeEvent) => {
    const window = options.getWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !event.senderFrame.url.startsWith("data:text/html;charset=utf-8,")
    )
      throw new Error("未授权的启动诊断调用");
  };
  ipcMain.handle("diagnostics:startup-state", (event) => {
    trusted(event);
    return options.snapshot();
  });
  ipcMain.handle("diagnostics:startup-retry", async (event) => {
    trusted(event);
    const state = options.snapshot();
    if (!state.failed || !state.canRetry || state.entered)
      throw new Error("当前状态不允许重试；运行状态未知时请自行退出后处理");
    options.resetProgress();
    try {
      await options.retry();
    } catch (error) {
      options.fail(error);
      throw error;
    }
  });
  ipcMain.handle("diagnostics:startup-copy", (event) => {
    trusted(event);
    clipboard.writeText(options.summary());
  });
  ipcMain.handle("diagnostics:startup-export", async (event) => {
    trusted(event);
    const selected = await dialog.showSaveDialog(options.getWindow()!, {
      defaultPath: `toolbox-startup-${options.journal.bootId}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (!selected.canceled && selected.filePath)
      await fs.writeFile(
        selected.filePath,
        JSON.stringify(
          {
            application: "ecommerce-toolbox",
            version: app.getVersion(),
            platform: process.platform,
            state: options.snapshot(),
            events: options.journal.events
          },
          null,
          2
        )
      );
  });
  ipcMain.handle("diagnostics:startup-logs", async (event) => {
    trusted(event);
    await shell.openPath(path.join(options.dataRoot, "logs"));
  });
  ipcMain.handle("diagnostics:startup-exit", (event) => {
    trusted(event);
    app.quit();
  });
}
