import { getDesktopAutoUpdater } from "../updates/desktop-updater";
import type { BrowserWindow } from "electron";
import type { DesktopBackend } from "./backend-port";
type MaintenanceContext = {
  getBackend: () => DesktopBackend | undefined;
  getMainWindow: () => BrowserWindow | undefined;
  getBackendOrigin: () => string | undefined;
  setBackendOrigin: (origin: string) => void;
  isOperation: () => boolean;
  setOperation: (active: boolean) => void;
  isPlaybackActive: () => boolean;
  setQuitting: (active: boolean) => void;
};

export function createDesktopMaintenance(context: MaintenanceContext) {
  async function withBackendStopped<T>(operation: () => Promise<T>) {
    if (context.isOperation()) throw new Error("已有桌面维护操作正在执行");
    if (!context.getBackend()) throw new Error("本地服务尚未启动");
    context.setOperation(true);
    try {
      const state = await context.getBackend()!.inspectShutdown(false);
      if (!state.prepared) throw new Error(state.reason || "请先结束任务和播放，再执行数据迁移");
      const stopped = await context.getBackend()!.stop();
      if (!stopped.clean) throw new Error("后台未正常完成收尾，已停止迁移。请重新打开应用并检查中断任务后再试。");
      let result: T | undefined;
      let operationError: unknown;
      try {
        result = await operation();
      } catch (error) {
        operationError = error;
      }
      try {
        context.setBackendOrigin(await context.getBackend()!.start());
        context.getBackend()!.monitorUnexpectedExit();
        if (context.getMainWindow() && context.getBackendOrigin())
          await context.getMainWindow()!.loadURL(context.getBackendOrigin()!);
      } catch (restartError) {
        throw new Error(`本地服务重启失败：${message(restartError)}`);
      }
      if (operationError) throw operationError;
      return result!;
    } finally {
      context.setOperation(false);
    }
  }
  async function installDownloadedUpdate() {
    if (!context.getBackend()) throw new Error("本地服务尚未启动");
    if (context.isOperation() || context.isPlaybackActive()) throw new Error("请先结束维护操作和音频播放，再安装更新");
    context.setOperation(true);
    try {
      const state = await context.getBackend()!.inspectShutdown(false);
      if (!state.prepared) throw new Error(state.reason || "请先结束后台任务，再安装更新");
      const stopped = await context.getBackend()!.stop();
      if (!stopped.clean) throw new Error("后台未正常完成收尾，已停止更新安装。请重新打开应用并检查后再试。");
      context.setQuitting(true);
      getDesktopAutoUpdater().quitAndInstall();
    } finally {
      context.setOperation(false);
    }
  }
  function message(error: unknown) {
    return error instanceof Error && error.message ? error.message : "未知错误";
  }
  return { withBackendStopped, installDownloadedUpdate };
}
