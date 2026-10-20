import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { DiagnosticJournal } from "../../../backend/src/runtime/diagnostic-journal";
import { diagnosticFailure } from "../../../packages/shared/src/diagnostics";
import { StartupProgress } from "./startup-progress";
import { startupDiagnosticsPage } from "./startup-diagnostics-page";
export class StartupDiagnostics {
  get bootId() {
    return this.journal.bootId;
  }
  private window?: BrowserWindow;
  private journal: DiagnosticJournal;
  private progress = new StartupProgress();
  constructor(private readonly options: { dataRoot: string; preload: string; retry: () => Promise<void> }) {
    this.journal = new DiagnosticJournal(path.join(options.dataRoot, "logs"));
    const trusted = (event: IpcMainInvokeEvent) => {
      if (
        !this.window ||
        event.sender !== this.window.webContents ||
        event.senderFrame !== this.window.webContents.mainFrame ||
        !event.senderFrame.url.startsWith("data:text/html;charset=utf-8,")
      )
        throw new Error("未授权的启动诊断调用");
    };
    ipcMain.handle("diagnostics:startup-state", (event) => {
      trusted(event);
      return this.progress.snapshot();
    });
    ipcMain.handle("diagnostics:startup-retry", async (event) => {
      trusted(event);
      const state = this.progress.snapshot();
      if (!state.failed || !state.canRetry || state.entered)
        throw new Error("当前状态不允许重试；运行状态未知时请自行退出后处理");
      this.progress.reset();
      this.publish();
      try {
        await options.retry();
      } catch (error) {
        this.fail(error);
        throw error;
      }
    });
    ipcMain.handle("diagnostics:startup-copy", (event) => {
      trusted(event);
      clipboard.writeText(this.summary());
    });
    ipcMain.handle("diagnostics:startup-export", async (event) => {
      trusted(event);
      const selected = await dialog.showSaveDialog(this.window!, {
        defaultPath: `toolbox-startup-${this.journal.bootId}.json`,
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
              state: this.progress.snapshot(),
              events: this.journal.events
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
  stage(stage: string) {
    if (!this.progress.stage(stage)) return;
    this.journal.record(stage, "STAGE_STARTED");
    this.publish();
  }
  ready() {
    this.progress.ready();
    this.publish();
    this.window?.close();
  }
  fail(error: unknown, canRetry = true) {
    const failure = diagnosticFailure(error);
    this.progress.fail(failure.code, failure.message, canRetry);
    this.journal.record("startup", failure.code);
    this.show();
    this.publish();
  }
  show() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      return;
    }
    const nonce = crypto.randomBytes(18).toString("hex");
    this.window = new BrowserWindow({
      width: 800,
      height: 700,
      minWidth: 600,
      minHeight: 500,
      title: "启动与环境诊断",
      webPreferences: { preload: this.options.preload, contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.window.webContents.setBackgroundThrottling(false);
    this.window.webContents.on("will-navigate", (event) => event.preventDefault());
    this.window.on("closed", () => {
      this.window = undefined;
    });
    void this.window
      .loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(startupDiagnosticsPage(this.progress.snapshot(), nonce))}`
      )
      .then(() => this.publish())
      .catch(() => this.journal.record("startup", "STARTUP_PAGE_LOAD_FAILED"));
  }
  private publish() {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send("diagnostics:startup-updated", this.progress.snapshot());
  }
  private summary() {
    const state = this.progress.snapshot();
    return `电商工具箱启动诊断\n阶段：${state.phase}\n${state.message}\n已完成 ${state.completedCount}/${state.totalSteps} 步 · 等待 ${Math.floor(state.elapsedMs / 1000)} 秒\n原因码：${state.code}`;
  }
}
