import { utilityProcess, type UtilityProcess } from "electron";
import type { RuntimeLayout } from "../../../backend/src/runtime/runtime-layout";

type BackendMessage =
  { type: "ready"; origin: string } | { type: "startup-error"; message: string } | { type: "stopped" };

export class BackendSupervisor {
  private child?: UtilityProcess;
  private origin?: string;
  private stopping = false;

  constructor(
    private readonly options: {
      entrypoint: string;
      runtimeLayout: RuntimeLayout;
      onUnexpectedExit?: (message: string) => void;
    }
  ) {}

  async start() {
    if (this.origin) return this.origin;
    if (this.child) throw new Error("Backend is already starting");
    const child = utilityProcess.fork(this.options.entrypoint, [], {
      cwd: this.options.runtimeLayout.appRoot,
      env: {
        ...process.env,
        TOOLBOX_RUNTIME_LAYOUT: JSON.stringify(this.options.runtimeLayout)
      }
    });
    this.child = child;

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => finish(new Error("本地服务启动超时")), 20_000);
      const finish = (error?: Error, origin?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.removeListener("message", onMessage);
        child.removeListener("exit", onExit);
        if (error) {
          if (this.child === child) this.child = undefined;
          child.kill();
          reject(error);
          return;
        }
        this.origin = origin;
        resolve(origin!);
      };
      const onMessage = (message: BackendMessage) => {
        if (message.type === "ready" && typeof message.origin === "string") finish(undefined, message.origin);
        if (message.type === "startup-error") finish(new Error(message.message));
      };
      const onExit = (code: number) => finish(new Error(`本地服务启动失败（退出码 ${code}）`));
      child.on("message", onMessage);
      child.once("exit", onExit);
    });
  }

  async stop() {
    const child = this.child;
    this.stopping = true;
    this.origin = undefined;
    this.child = undefined;
    if (!child) return;

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill();
        resolve();
      }, 10_000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      child.postMessage({ type: "shutdown" });
    });
  }

  monitorUnexpectedExit() {
    const child = this.child;
    if (!child) return;
    child.on("exit", (code) => {
      if (this.stopping) return;
      this.origin = undefined;
      this.child = undefined;
      this.options.onUnexpectedExit?.(`本地服务意外退出（退出码 ${code}）`);
    });
  }
}
