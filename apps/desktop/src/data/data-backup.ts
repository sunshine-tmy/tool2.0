/** Desktop owns native selections, progress and helper lifetime; API owns business data formats. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { utilityProcess } from "electron";
import type { RuntimeLayout } from "@toolbox/runtime-core";
import type {
  BackupState,
  BackupOperation,
  BackupModuleId,
  BackupMode,
  BackupSelection,
  BackupPreview,
  BackupModuleSummary
} from "@toolbox/shared/system";
import { cleanBackupPreferences } from "@toolbox/shared/system";
import type { DesktopIpcContext } from "../ipc/desktop-context";
export type BackupCommand = {
  action: "recover" | "snapshot" | "pack" | "inspect" | "preview" | "restore" | "rollback";
  id: string;
  file?: string;
  selection?: BackupSelection;
  modules?: BackupModuleId[];
  mode?: BackupMode;
  planId?: string;
  restorePointId?: string;
  preferences?: Record<string, string>;
};
type Progress = Pick<BackupOperation, "phase" | "files" | "totalFiles" | "bytes" | "totalBytes">;
export type HelperRunner = (
  command: BackupCommand,
  signal: AbortSignal,
  progress: (state: Progress) => void
) => Promise<unknown>;
export function createBackupHelper(layout: RuntimeLayout, entrypoint: string, appVersion: string): HelperRunner {
  return (command, signal, progress) =>
    new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const child = utilityProcess.fork(entrypoint, [], {
        cwd: layout.appRoot,
        env: { ...process.env, TOOLBOX_RUNTIME_LAYOUT: JSON.stringify(layout), TOOLBOX_APP_VERSION: appVersion },
        stdio: "pipe"
      });
      let result: unknown,
        failure: Error | undefined,
        ready = false,
        gotResult = false;
      // Drain both pipes to avoid blocking a child on diagnostics, without exposing environment values.
      child.stdout?.on("data", () => undefined);
      child.stderr?.on("data", () => undefined);
      const cancel = () => child.postMessage({ type: "cancel" });
      signal.addEventListener("abort", cancel, { once: true });
      const timer = setTimeout(() => {
        if (!ready) {
          failure = new Error("备份辅助进程启动超时");
          child.kill();
        }
      }, 15000);
      child.on(
        "message",
        (message: { type?: string; message?: string; result?: unknown; canceled?: boolean } & Partial<Progress>) => {
          if (message.type === "ready") {
            ready = true;
            clearTimeout(timer);
            child.postMessage({ type: "run", command });
            if (signal.aborted) cancel();
          }
          if (message.type === "progress" && typeof message.phase === "string") progress(message as Progress);
          if (message.type === "result") {
            gotResult = true;
            result = message.result;
          }
          if (message.type === "error")
            failure = Object.assign(new Error(message.message || "备份辅助进程失败"), {
              canceled: message.canceled === true
            });
        }
      );
      child.once("error", (error) => {
        failure = new Error(String(error));
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
        if (failure || code !== 0 || !gotResult) reject(failure ?? new Error("备份辅助进程意外退出，请检查恢复点"));
        else resolve(result);
      });
    });
}
export class DesktopDataBackup {
  private operations: BackupOperation[] = [];
  private active?: { id: string; controller: AbortController };
  private preparing = false;
  private preflight?: { controller: AbortController; state: NonNullable<BackupState["preflight"]> };
  private plans = new Map<string, { expires: number; mode: BackupMode }>();
  private selections = new Map<string, { file: string; expires: number }>();
  private tail: Promise<unknown> = Promise.resolve();
  readonly root: string;
  constructor(
    private context: Pick<DesktopIpcContext, "layout" | "withBackendStopped">,
    private helper: HelperRunner
  ) {
    this.root = path.resolve(context.layout.configRoot, "..", "module-backups");
  }
  private async persist() {
    const content = JSON.stringify(this.operations);
    this.tail = this.tail
      .catch(() => undefined)
      .then(async () => {
        await fs.mkdir(this.root, { recursive: true });
        const temp = path.join(this.root, `operations-${crypto.randomUUID()}.tmp`);
        const handle = await fs.open(temp, "wx");
        try {
          await handle.writeFile(content);
          await handle.sync();
        } finally {
          await handle.close();
        }
        await fs.rename(temp, path.join(this.root, "operations.json"));
      });
    await this.tail;
  }
  async initialize() {
    this.idle();
    try {
      this.operations = JSON.parse(
        await fs.readFile(path.join(this.root, "operations.json"), "utf8")
      ) as BackupOperation[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await this.helper({ action: "recover", id: crypto.randomUUID() }, new AbortController().signal, () => undefined);
    const work = path.resolve(this.root, "work");
    if (path.dirname(work) !== path.resolve(this.root)) throw new Error("备份暂存位置无效");
    const workStat = await fs.lstat(work).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (workStat?.isSymbolicLink()) throw new Error("备份暂存目录不允许链接");
    await fs.rm(work, { recursive: true, force: true });
    for (const operation of this.operations)
      if (operation.status === "running") {
        operation.status = "failed";
        operation.cancelable = false;
        operation.finishedAt = new Date().toISOString();
        operation.message = "上次操作随应用退出中断；已执行启动恢复，请检查数据后重新预检。已有恢复点保留。";
      }
    await this.persist();
  }
  private idle() {
    if (this.active || this.preparing) throw new Error("已有备份、预检或恢复操作正在进行");
  }
  async state(): Promise<BackupState> {
    let pending: Promise<unknown>;
    do {
      pending = this.tail;
      await pending;
    } while (pending !== this.tail);
    const restorePoints: BackupState["restorePoints"] = [];
    for (const entry of await fs.readdir(path.join(this.root, "restore-points")).catch(() => [])) {
      if (!/^[a-f0-9-]{36}$/.test(entry)) continue;
      try {
        const manifest = JSON.parse(
          await fs.readFile(path.join(this.root, "restore-points", entry, "manifest.json"), "utf8")
        ) as { createdAt: string; modules: BackupModuleSummary[] };
        restorePoints.push({
          id: entry,
          createdAt: manifest.createdAt,
          modules: manifest.modules.map((m) => m.id),
          bytes: manifest.modules.reduce((n, m) => n + m.bytes, 0)
        });
      } catch {
        if (this.active?.id === entry) continue;
        restorePoints.push({
          id: entry,
          createdAt: new Date(0).toISOString(),
          modules: [],
          bytes: 0,
          problem: "恢复点不完整或清单损坏；目录已保留，可手动删除。"
        });
      }
    }
    do {
      pending = this.tail;
      await pending;
    } while (pending !== this.tail);
    return {
      operations: structuredClone(
        [...this.operations]
          .reverse()
          .map((operation) =>
            this.active?.id === operation.id && operation.status !== "running"
              ? { ...operation, status: "running" as const, phase: "保存操作结果", cancelable: false }
              : operation
          )
      ),
      restorePoints: restorePoints.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ...(this.preflight ? { preflight: structuredClone(this.preflight.state) } : {})
    };
  }
  async select(file: string) {
    this.idle();
    this.preparing = true;
    try {
      const id = crypto.randomUUID();
      const controller = new AbortController();
      this.preflight = {
        controller,
        state: { id, phase: "检查备份文件", files: 0, totalFiles: 0, bytes: 0, totalBytes: 0, cancelable: true }
      };
      const modules = (await this.helper({ action: "inspect", id, file }, controller.signal, (value) => {
        if (this.preflight) Object.assign(this.preflight.state, value);
      })) as BackupModuleSummary[];
      this.selections.set(id, { file, expires: Date.now() + 30 * 60_000 });
      return { canceled: false, selectionId: id, displayName: path.basename(file), modules };
    } finally {
      this.preparing = false;
      this.preflight = undefined;
    }
  }
  async preview(selectionId: string, modules: BackupModuleId[], mode: BackupMode) {
    this.idle();
    this.preparing = true;
    try {
      const selection = this.selections.get(selectionId);
      if (!selection || selection.expires < Date.now()) throw new Error("备份选择已失效，请重新选择");
      const id = crypto.randomUUID();
      const controller = new AbortController();
      this.preflight = {
        controller,
        state: { id, phase: "预检导入数据", files: 0, totalFiles: 0, bytes: 0, totalBytes: 0, cancelable: true }
      };
      const result = (await this.helper(
        { action: "preview", id, file: selection.file, modules, mode },
        controller.signal,
        (value) => {
          if (this.preflight) Object.assign(this.preflight.state, value);
        }
      )) as BackupPreview;
      this.plans.set(id, { expires: Date.parse(result.expiresAt), mode });
      return result;
    } finally {
      this.preparing = false;
      this.preflight = undefined;
    }
  }
  async export(selection: BackupSelection, file: string) {
    return this.start(
      "export",
      async (id, signal, progress) => {
        await this.context.withBackendStopped(
          () => this.helper({ action: "snapshot", id, selection }, signal, progress),
          {
            returnPath: "/settings/data-backup",
            requireIdlePlayback: true,
            afterRestart: () => this.helper({ action: "pack", id, file }, signal, progress).then(() => undefined)
          }
        );
        return {};
      },
      selection.clientPreferences
    );
  }
  async restore(planId: string, clientPreferences?: Record<string, string>) {
    const plan = this.plans.get(planId);
    if (!plan || plan.expires < Date.now()) throw new Error("导入预检已失效，请重新预检");
    this.plans.delete(planId);
    return this.start(
      "import",
      (id, signal, progress) =>
        this.context.withBackendStopped(
          () =>
            this.helper(
              { action: "restore", id, planId, preferences: cleanBackupPreferences(clientPreferences) },
              signal,
              progress
            ),
          {
            returnPath: "/settings/data-backup",
            requireIdlePlayback: true
          }
        ),
      clientPreferences,
      plan.mode === "merge"
    );
  }
  async rollback(point: string, clientPreferences?: Record<string, string>) {
    this.validId(point);
    return this.start(
      "rollback",
      (id, signal, progress) =>
        this.context.withBackendStopped(
          () =>
            this.helper(
              { action: "rollback", id, restorePointId: point, preferences: cleanBackupPreferences(clientPreferences) },
              signal,
              progress
            ),
          {
            returnPath: "/settings/data-backup",
            requireIdlePlayback: true
          }
        ),
      clientPreferences
    );
  }
  async cancel(id: string) {
    if (this.preflight?.state.id === id) {
      this.preflight.controller.abort(new Error("用户取消"));
      return;
    }
    const operation = this.operations.find((o) => o.id === id);
    if (this.active?.id !== id || !operation?.cancelable) throw new Error("当前阶段正在安全收尾，请等待完成");
    this.active.controller.abort(new Error("用户取消"));
  }
  async deletePoint(id: string) {
    this.idle();
    this.validId(id);
    const target = path.resolve(this.root, "restore-points", id),
      parent = path.resolve(this.root, "restore-points");
    if (path.dirname(target) !== parent) throw new Error("恢复点位置无效");
    const stat = await fs.lstat(target);
    for (const folder of [this.root, parent])
      if ((await fs.lstat(folder)).isSymbolicLink()) throw new Error("恢复点父目录异常");
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("恢复点目录异常");
    await fs.rm(target, { recursive: true, force: false });
  }
  private validId(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("操作编号无效");
  }
  private async start(
    type: BackupOperation["type"],
    action: (id: string, signal: AbortSignal, progress: (value: Progress) => void) => Promise<unknown>,
    clientPreferences?: Record<string, string>,
    preferTarget = false
  ) {
    this.idle();
    const id = crypto.randomUUID(),
      controller = new AbortController();
    this.active = { id, controller };
    const operation: BackupOperation = {
      id,
      type,
      status: "running",
      phase: "等待维护",
      files: 0,
      totalFiles: 0,
      bytes: 0,
      totalBytes: 0,
      cancelable: true,
      startedAt: new Date().toISOString()
    };
    this.operations.push(operation);
    try {
      await this.persist();
    } catch (error) {
      this.active = undefined;
      operation.status = "failed";
      operation.message = "无法保存操作记录，尚未开始维护";
      throw error;
    }
    let lastPersist = 0;
    const progress = (value: Progress) => {
      Object.assign(operation, value);
      operation.cancelable = value.phase !== "正在安全提交";
      if (Date.now() - lastPersist > 500) {
        lastPersist = Date.now();
        void this.persist().catch(() => undefined);
      }
    };
    void (async () => {
      try {
        const result = (await action(id, controller.signal, progress)) as {
          restorePointId?: string;
          preferences?: Record<string, string>;
        };
        Object.assign(operation, {
          status: "completed",
          phase: "已完成",
          ...result,
          preferences: preferTarget
            ? { ...cleanBackupPreferences(result?.preferences), ...cleanBackupPreferences(clientPreferences) }
            : { ...cleanBackupPreferences(clientPreferences), ...cleanBackupPreferences(result?.preferences) }
        });
      } catch (error) {
        const canceled =
          controller.signal.aborted &&
          (error === controller.signal.reason || Boolean((error as { canceled?: boolean } | undefined)?.canceled));
        operation.status = canceled ? "canceled" : "failed";
        operation.phase = canceled ? "已取消" : "失败";
        operation.message = error instanceof Error ? error.message : "备份操作失败";
        if (await fs.stat(path.join(this.root, "restore-points", id, "manifest.json")).catch(() => undefined))
          operation.restorePointId = id;
      } finally {
        operation.cancelable = false;
        operation.finishedAt = new Date().toISOString();
        const work = path.resolve(this.root, "work", id);
        if (path.dirname(work) !== path.resolve(this.root, "work"))
          operation.message = "备份操作暂存位置无效，已保留缓存";
        else
          await fs.rm(work, { recursive: true, force: true }).catch(() => {
            operation.message = `${operation.message ?? "操作完成"}；本次临时缓存清理失败，可重启后重试清理。`;
          });
        await this.persist();
        this.active = undefined;
      }
    })().catch((error) => {
      this.active = undefined;
      operation.status = "failed";
      operation.message = `无法保存操作结果：${error instanceof Error ? error.message : "未知错误"}`;
    });
    return id;
  }
}
