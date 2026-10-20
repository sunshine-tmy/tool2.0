/** 只报告已经收到的阶段，不把等待时长换算成百分比。 */
export const startupSteps = [
  { id: "storage", label: "准备桌面存储", description: "正在准备本地数据目录，已有作品和模型不会删除。" },
  { id: "migration", label: "检查数据迁移", description: "正在检查迁移记录；需要你的选择时会打开迁移窗口。" },
  { id: "proxy", label: "读取代理设置", description: "正在读取系统代理配置，此步骤不会下载模型。" },
  { id: "process", label: "启动后台进程", description: "正在启动后台进程并建立子服务退出保护。" },
  { id: "config", label: "读取服务配置", description: "正在读取本地服务配置。" },
  { id: "database", label: "初始化数据库", description: "正在打开数据库并检查就绪状态。" },
  { id: "directories", label: "检查业务存储", description: "正在检查业务数据目录和已有记录。" },
  { id: "service", label: "启动本地接口", description: "正在启动本地接口并等待服务就绪。" },
  { id: "window", label: "打开主界面", description: "基础服务已就绪，正在加载应用主界面。" }
] as const;

export type StartupStepId = (typeof startupSteps)[number]["id"];
export type StartupSnapshot = {
  revision: number;
  phase: string;
  stageId: StartupStepId | "ready";
  failed: boolean;
  canRetry: boolean;
  code: string;
  message: string;
  entered: boolean;
  elapsedMs: number;
  stageElapsedMs: number;
  completedCount: number;
  totalSteps: number;
  steps: Array<{ id: StartupStepId; label: string; status: "pending" | "active" | "completed" | "failed" }>;
};

export class StartupProgress {
  private revision = 0;
  private startedAt = Date.now();
  private stageAt = this.startedAt;
  private endedAt?: number;
  private completed = new Set<StartupStepId>();
  private current: StartupStepId = "storage";
  private failure?: { code: string; message: string; canRetry: boolean };
  private entered = false;

  reset() {
    this.revision++;
    this.startedAt = this.stageAt = Date.now();
    this.endedAt = undefined;
    this.completed.clear();
    this.current = "storage";
    this.failure = undefined;
    this.entered = false;
  }
  stage(id: string) {
    const index = startupSteps.findIndex((step) => step.id === id);
    if (index < 0 || this.failure || this.entered) return false;
    // 旧事件、重复事件不能倒退进度或重置当前阶段的等待时间。
    if (index <= startupSteps.findIndex((step) => step.id === this.current)) return false;
    this.completed.add(this.current);
    this.revision++;
    this.current = startupSteps[index].id;
    this.stageAt = Date.now();
    return true;
  }
  ready() {
    this.revision++;
    this.completed.add(this.current);
    this.entered = true;
    this.failure = undefined;
    this.endedAt = Date.now();
  }
  fail(code: string, message: string, canRetry: boolean) {
    this.revision++;
    this.failure = { code, message, canRetry: canRetry && !this.entered };
    this.endedAt ??= Date.now();
  }
  snapshot(): StartupSnapshot {
    const now = this.endedAt ?? Date.now();
    const current = startupSteps.find((step) => step.id === this.current)!;
    return {
      revision: this.revision,
      stageId: this.entered ? "ready" : this.current,
      phase: this.entered ? (this.failure ? "运行中服务异常" : "进入应用") : current.label,
      failed: Boolean(this.failure),
      canRetry: this.failure?.canRetry ?? false,
      code: this.failure?.code ?? (this.entered ? "READY" : "STARTING"),
      message:
        this.failure?.message ??
        (this.entered ? "基础服务和主界面已就绪；可选能力在后台继续准备。" : current.description),
      entered: this.entered,
      elapsedMs: Math.max(0, now - this.startedAt),
      stageElapsedMs: Math.max(0, now - this.stageAt),
      completedCount: this.completed.size,
      totalSteps: startupSteps.length,
      steps: startupSteps.map((step) => ({
        id: step.id,
        label: step.label,
        status: this.completed.has(step.id)
          ? "completed"
          : step.id === this.current
            ? this.failure
              ? "failed"
              : "active"
            : "pending"
      }))
    };
  }
}
