import { BrowserWindow } from "electron";

const labels: Record<string, string> = {
  tasks: "正在停止播放、任务调度并保存任务状态",
  workers: "正在关闭子服务并释放模型资源",
  database: "正在关闭数据库",
  cleanup: "正在回收超时的后台进程",
  verify: "正在确认后台服务已全部退出"
};

export class ShutdownWindow {
  private window?: BrowserWindow;
  constructor(private readonly retry: () => void) {}
  show(stage = "tasks") {
    if (!labels[stage]) return;
    if (!this.window || this.window.isDestroyed()) {
      this.window = new BrowserWindow({
        width: 440,
        height: 200,
        resizable: false,
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        title: "正在退出电商工具箱",
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
      });
      this.window.on("close", (event) => {
        event.preventDefault();
        this.retry();
      });
      this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      this.window.webContents.on("will-navigate", (event) => event.preventDefault());
    }
    // 只显示固定阶段文本；没有 IPC、任意日志、脚本或外部资源。
    const html = `<html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{margin:0;padding:28px;font:14px/1.7 system-ui;color:#243047;background:#f7f9fc}h2{font-size:18px;margin:0 0 12px}p{margin:6px 0}small{color:#64748b}</style></head><body><h2>正在退出电商工具箱</h2><p>${labels[stage]}</p><small>请稍候，已保存的作品和模型文件不会删除。</small></body></html>`;
    void this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => undefined);
  }
}
