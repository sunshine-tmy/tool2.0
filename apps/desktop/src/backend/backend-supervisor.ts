import { utilityProcess, type UtilityProcess } from "electron";
import type { RuntimeLayout } from "@toolbox/runtime-core";
import { DiagnosticJournal } from "@toolbox/runtime-core";
import path from "node:path";
import { guardBackendProcess, type ProcessGuard } from "./process-guard";
import type { ShutdownInspection, ShutdownPreparation } from "@toolbox/shared/desktop";
import { waitForGracefulShutdown } from "./shutdown-wait";

type BackendMessage =
  | { type: "spawned" }
  | { type: "ready"; origin: string }
  | { type: "startup-error"; message: string; code?: string }
  | { type: "stage"; stage: string }
  | { type: "shutdown-stage"; stage: string }
  | { type: "shutdown-error" }
  | { type: "stopped" };

export class BackendSupervisor {
  private child?: UtilityProcess;
  private origin?: string;
  private stopping = false;
  private guard?: ProcessGuard;
  private stopPromise?: Promise<{ clean: boolean }>;
  private exitCode?: number;
  private shutdownFailed = false;
  private requestId = 0;
  startupTerminated = true;

  constructor(
    private readonly options: {
      entrypoint: string;
      runtimeLayout: RuntimeLayout;
      componentProxyUrl?: string;
      bootId?: string;
      onUnexpectedExit?: (message: string) => void;
      onStage?: (stage: string) => void;
      onShutdownStage?: (stage: string) => void;
    }
  ) {}

  async start() {
    if (this.origin) return this.origin;
    if (this.child) throw new Error("Backend is already starting");
    if (this.guard) {
      await this.guard.close();
      this.guard = undefined;
    }
    this.stopping = false;
    this.exitCode = undefined;
    this.shutdownFailed = false;
    this.stopPromise = undefined;
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      TOOLBOX_BOOT_ID: this.options.bootId,
      TOOLBOX_RUNTIME_LAYOUT: JSON.stringify(this.options.runtimeLayout)
    };
    const componentProxyUrl = this.options.componentProxyUrl ?? process.env.TOOLBOX_COMPONENT_HTTPS_PROXY;
    if (componentProxyUrl) environment.TOOLBOX_COMPONENT_HTTPS_PROXY = componentProxyUrl;
    else delete environment.TOOLBOX_COMPONENT_HTTPS_PROXY;
    const child = utilityProcess.fork(this.options.entrypoint, [], {
      cwd: this.options.runtimeLayout.appRoot,
      env: environment,
      stdio: "pipe"
    });
    this.child = child;
    this.startupTerminated = false;
    let exited = false;
    child.once("exit", (code: number) => {
      exited = true;
      this.exitCode = code;
      this.startupTerminated = true;
    });
    const journal = new DiagnosticJournal(
      path.join(this.options.runtimeLayout.storageRoot, "..", "logs"),
      this.options.bootId
    );
    journal.record("backend", "SERVICE_STARTING");
    child.on("message", (message: BackendMessage) => {
      if (message.type === "shutdown-error") {
        this.shutdownFailed = true;
        journal.record("shutdown", "SHUTDOWN_STATE_SAVE_FAILED");
      }
      if (message.type === "shutdown-stage" && ["tasks", "workers", "database"].includes(message.stage)) {
        journal.record(`shutdown-${message.stage}`, "STAGE_STARTED");
        this.options.onShutdownStage?.(message.stage);
      }
    });
    child.stdout?.on("data", (chunk: Buffer) => journal.consume("backend", chunk));
    child.stderr?.on("data", (chunk: Buffer) => journal.consume("backend", chunk));

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(
        () => finish(Object.assign(new Error("本地服务启动超时"), { code: "ETIMEDOUT" })),
        40_000
      );
      const finish = (error?: Error, origin?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.removeListener("message", onMessage);
        child.removeListener("exit", onExit);
        if (error) {
          void this.guard
            ?.close()
            .then(() => {
              this.guard = undefined;
            })
            .catch(() => undefined);
          if (exited) {
            if (this.child === child) this.child = undefined;
            reject(error);
            return;
          }
          const ending = setTimeout(() => {
            this.startupTerminated = false;
            reject(error);
          }, 5000);
          child.once("exit", () => {
            clearTimeout(ending);
            if (this.child === child) this.child = undefined;
            reject(error);
          });
          child.kill();
          return;
        }
        this.origin = origin;
        resolve(origin!);
      };
      const onMessage = (message: BackendMessage) => {
        if (message.type === "spawned") {
          void (async () => {
            if (!child.pid) throw new Error("无法识别本地服务进程");
            const guard = await guardBackendProcess(child.pid);
            if (this.stopping || exited || settled) {
              await guard?.close();
              return;
            }
            this.guard = guard;
            child.postMessage({ type: "start" });
          })().catch((error: Error) => finish(error));
        }
        if (message.type === "stage") this.options.onStage?.(message.stage);
        if (message.type === "ready" && typeof message.origin === "string") finish(undefined, message.origin);
        if (message.type === "startup-error") {
          const error = Object.assign(new Error(message.message), { code: message.code });
          finish(error);
        }
      };
      const onExit = (code: number) => finish(new Error(`本地服务启动失败（退出码 ${code}）`));
      child.on("message", onMessage);
      child.once("exit", onExit);
    });
  }

  async stop() {
    return (this.stopPromise ??= this.stopOnce().finally(() => {
      this.stopPromise = undefined;
    }));
  }

  async inspectShutdown(confirmed?: boolean): Promise<ShutdownPreparation> {
    const child = this.child;
    if (!child || !this.origin) {
      if (child) throw new Error("本地服务仍在启动或状态未知，请稍后再退出");
      return { busy: false, blocked: false, prepared: true };
    }
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const finish = (error?: Error, state?: ShutdownPreparation) => {
        clearTimeout(timer);
        child.removeListener("message", onMessage);
        child.removeListener("exit", onExit);
        if (error) reject(error);
        else resolve(state!);
      };
      const onMessage = (message: {
        type?: string;
        id?: number;
        state?: ShutdownInspection & { prepared?: boolean };
      }) => {
        if (message.type === "shutdown-inspection" && message.id === id && message.state)
          finish(undefined, { ...message.state, prepared: message.state.prepared === true });
      };
      const onExit = () => finish(new Error("本地服务已退出，无法确认任务状态"));
      const timer = setTimeout(() => finish(new Error("无法确认后台任务状态，请稍后重试")), 5000);
      child.on("message", onMessage);
      child.once("exit", onExit);
      child.postMessage({ type: confirmed === undefined ? "shutdown-inspect" : "shutdown-prepare", id, confirmed });
    });
  }

  private async stopOnce() {
    const child = this.child;
    this.stopping = true;
    this.origin = undefined;
    const journal = new DiagnosticJournal(
      path.join(this.options.runtimeLayout.storageRoot, "..", "logs"),
      this.options.bootId
    );
    journal.record("shutdown", "SHUTDOWN_STARTED");
    let exited = !child || this.startupTerminated;
    const exit =
      child && !exited
        ? new Promise<void>((resolve) =>
            child.once("exit", () => {
              exited = true;
              resolve();
            })
          )
        : Promise.resolve();
    const wait = async (ms: number) => {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        exit,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, ms);
        })
      ]);
      if (timer) clearTimeout(timer);
      return exited;
    };
    if (child && !exited) {
      const graceful = waitForGracefulShutdown(child, exit);
      child.postMessage({ type: "shutdown" });
      if (!(await graceful)) {
        journal.record("shutdown", "SHUTDOWN_GRACE_TIMEOUT");
        this.options.onShutdownStage?.("cleanup");
        // Windows 先终止整个受控 Job，再确认主进程退出；不按名称或端口清理其他程序。
        if (!this.guard) child.kill();
      }
    }
    this.options.onShutdownStage?.("verify");
    let forced = false;
    if (this.guard) {
      let result: { forced: boolean };
      try {
        result = await this.guard.close();
      } catch (error) {
        journal.record("shutdown", "SHUTDOWN_UNCONFIRMED");
        throw error;
      }
      forced = result.forced;
      journal.record("shutdown", result.forced ? "SHUTDOWN_FORCED_CLEANUP" : "SHUTDOWN_CHILDREN_STOPPED");
      this.guard = undefined;
    }
    if (!exited && !(await wait(5000))) {
      journal.record("shutdown", "SHUTDOWN_UNCONFIRMED");
      throw new Error("无法确认本地服务已退出，应用将保留关闭窗口，请检查后重试");
    }
    if (this.child === child) this.child = undefined;
    journal.record("shutdown", "SHUTDOWN_COMPLETE");
    return { clean: !forced && !this.shutdownFailed && (this.exitCode === undefined || this.exitCode === 0) };
  }

  monitorUnexpectedExit() {
    const child = this.child;
    if (!child) return;
    child.on("exit", (code) => {
      if (this.stopping || this.child !== child) return;
      this.origin = undefined;
      this.child = undefined;
      void this.guard
        ?.close()
        .then(() => {
          this.guard = undefined;
        })
        .catch(() => undefined);
      this.options.onUnexpectedExit?.(`本地服务意外退出（退出码 ${code}）`);
    });
  }
}
