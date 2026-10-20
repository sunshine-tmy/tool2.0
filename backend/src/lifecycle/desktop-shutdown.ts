/** 桌面退出握手：先冻结写入并复查，再开始关闭；只通过父进程 IPC 使用。 */
export type ShutdownInspection = { busy: boolean; blocked: boolean; reason?: string };
export type ShutdownPreparation = ShutdownInspection & { prepared: boolean };

export class DesktopShutdown {
  private closing = false;
  private requests = new Set<object | string>();
  private inspectResources: () => ShutdownInspection = () => ({ busy: false, blocked: false });

  bind(inspect: () => ShutdownInspection) {
    this.inspectResources = inspect;
  }
  get prepared() {
    return this.closing;
  }
  enter(id: object | string) {
    if (this.closing)
      throw Object.assign(new Error("应用正在退出，暂不接受新操作"), { statusCode: 503, code: "APP_SHUTTING_DOWN" });
    this.requests.add(id);
  }
  leave(id: object | string) {
    this.requests.delete(id);
  }
  inspect(): ShutdownInspection {
    const resources = this.inspectResources();
    if (this.requests.size) return { busy: true, blocked: true, reason: "有操作正在保存或提交，请稍后再退出" };
    return resources;
  }
  prepare(confirmed: boolean): ShutdownPreparation {
    if (this.closing) return { busy: false, blocked: false, prepared: true };
    // 此处无 await：复查和冻结在同一个事件循环回合完成，防止确认框期间新任务进入。
    const state = this.inspect();
    if (state.blocked || (state.busy && !confirmed)) return { ...state, prepared: false };
    this.closing = true;
    return { ...state, prepared: true };
  }
}
