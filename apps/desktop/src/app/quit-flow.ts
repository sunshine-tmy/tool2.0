import { app, dialog, type BrowserWindow } from "electron";
import { QuitCoordinator } from "./quit-coordinator";
import { ShutdownWindow } from "../windows/shutdown-window";
import type { DesktopBackend } from "./backend-port";
type QuitContext = {
  getBackend: () => Pick<DesktopBackend, "inspectShutdown" | "stop"> | undefined;
  getMainWindow: () => BrowserWindow | undefined;
  clearMainWindow: () => void;
  isOperation: () => boolean;
  isPlaybackActive: () => boolean;
  setPlaybackActive: (active: boolean) => void;
  isQuitting: () => boolean;
  setQuitting: (active: boolean) => void;
  clearAutomaticUpdateTimer: () => void;
};
export function createDesktopQuitFlow(context: QuitContext) {
  let quitCoordinator: QuitCoordinator | undefined, shutdownWindow: ShutdownWindow | undefined;
  function beforeQuit(event: { preventDefault(): void }) {
    if (context.isQuitting()) return;
    event.preventDefault();
    quitCoordinator ??= new QuitCoordinator({
      critical: () => context.isOperation(),
      playing: () => context.isPlaybackActive(),
      inspect: async (confirmed) =>
        context.getBackend()?.inspectShutdown(confirmed) ?? { busy: false, blocked: false, prepared: true },
      confirm: async () => {
        const result = await dialog.showMessageBox({
          type: "warning",
          title: "退出电商工具箱",
          message: "有任务、等待队列或音频播放尚未结束，仍要退出吗？",
          detail: "退出会停止播放并中断未完成的生成任务，保留文案、参考音色和已生成作品；中断任务需手动重试。",
          buttons: ["继续使用", "停止并退出"],
          defaultId: 0,
          cancelId: 0,
          noLink: true
        });
        return result.response === 1;
      },
      notify: async (text) => {
        await dialog.showMessageBox({ type: "warning", title: "退出尚未完成", message: text });
      },
      begin: () => {
        context.clearAutomaticUpdateTimer();
        shutdownWindow ??= new ShutdownWindow(() => app.quit());
        shutdownWindow.show();
        // 确认退出后销毁业务 renderer，立即停止独立/队列/WebAudio 播放，不依赖页面响应。
        context.getMainWindow()?.destroy();
        context.clearMainWindow();
        context.setPlaybackActive(false);
      },
      stop: async () => {
        const result = await context.getBackend()?.stop();
        if (result && !result.clean)
          await dialog.showMessageBox({
            type: "warning",
            title: "后台服务已回收",
            message: "部分任务收尾异常或子服务已被强制回收。",
            detail: "后台进程已退出；下次启动请检查中断任务并手动重试。现有作品和模型文件不会删除。"
          });
      },
      finish: () => {
        context.setQuitting(true);
        app.exit(0);
      }
    });
    void quitCoordinator.request();
  }
  return { beforeQuit, showStage: (stage: string) => shutdownWindow?.show(stage) };
}
