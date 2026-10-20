import type { ShutdownPreparation } from "../../../backend/src/lifecycle/desktop-shutdown";

/** 所有退出入口共用同一握手；确认后再次冻结和复查，不向 renderer 暴露强杀权限。 */
export class QuitCoordinator {
  private pending?: Promise<boolean>;
  private committed = false;
  complete = false;
  constructor(
    private readonly options: {
      inspect: (confirmed?: boolean) => Promise<ShutdownPreparation>;
      critical: () => boolean;
      playing: () => boolean;
      confirm: () => Promise<boolean>;
      notify: (message: string) => Promise<void>;
      begin: () => void;
      stop: () => Promise<void>;
      finish: () => void;
    }
  ) {}
  request() {
    return (this.pending ??= this.run().finally(() => {
      this.pending = undefined;
    }));
  }
  private async run() {
    if (this.complete) return true;
    try {
      if (!this.committed) {
        if (this.options.critical()) {
          await this.options.notify("正在安装更新或迁移数据，请完成后再退出，避免中断数据切换。");
          return false;
        }
        const state = await this.options.inspect();
        if (state.blocked) {
          await this.options.notify(state.reason || "有关键操作正在执行，请完成后再退出。");
          return false;
        }
        let confirmed = state.busy || this.options.playing();
        if (confirmed && !(await this.options.confirm())) return false;
        let prepared = await this.options.inspect(confirmed);
        if (!prepared.prepared && prepared.busy && !prepared.blocked && !confirmed) {
          // 检查与冻结之间出现了新任务：必须重新征求确认，不能静默中断。
          confirmed = await this.options.confirm();
          if (!confirmed) return false;
          prepared = await this.options.inspect(true);
        }
        if (this.options.critical() || !prepared.prepared) {
          await this.options.notify(prepared.reason || "当前仍有操作正在保存，请稍后再退出。");
          return false;
        }
        this.committed = true;
        this.options.begin();
      }
      await this.options.stop();
      this.complete = true;
      this.options.finish();
      return true;
    } catch {
      await this.options.notify(
        this.committed
          ? "未能确认所有后台进程已退出。关闭窗口将重试回收；请勿删除模型或数据。若持续失败，请检查任务管理器中的本应用进程。"
          : "暂时无法确认后台状态，尚未开始退出。请稍后重试；若服务无响应，请先检查诊断信息。"
      );
      return false;
    }
  }
}
