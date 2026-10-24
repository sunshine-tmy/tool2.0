import { registerStartupDiagnosticsIpc } from "../ipc/startup-diagnostics-ipc";
import path from "node:path";
import crypto from "node:crypto";
import { BrowserWindow } from "electron";
import { DiagnosticJournal } from "@toolbox/runtime-core";
import { diagnosticFailure } from "../../../../packages/shared/src/system/diagnostics";
import { StartupProgress } from "./startup-progress";
import { startupDiagnosticsPage } from "../windows/startup-diagnostics-page";
export class StartupDiagnostics {
  get bootId() {
    return this.journal.bootId;
  }
  private window?: BrowserWindow;
  private journal: DiagnosticJournal;
  private progress = new StartupProgress();
  constructor(private readonly options: { dataRoot: string; preload: string; retry: () => Promise<void> }) {
    this.journal = new DiagnosticJournal(path.join(options.dataRoot, "logs"));
    registerStartupDiagnosticsIpc({
      dataRoot: options.dataRoot,
      getWindow: () => this.window,
      journal: this.journal,
      snapshot: () => this.progress.snapshot(),
      summary: () => this.summary(),
      resetProgress: () => {
        this.progress.reset();
        this.publish();
      },
      retry: options.retry,
      fail: (error) => this.fail(error)
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
