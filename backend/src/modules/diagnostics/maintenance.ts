/** 维护期间阻止新业务写入；先获取锁再复查队列，防止检查与执行之间竞态。 */
export class MaintenanceGate {
  private owner?: string;
  private requests = new Set<string>();
  get locked() {
    return Boolean(this.owner);
  }
  enterRequest(id: string) {
    if (this.owner)
      throw Object.assign(new Error("环境检查或恢复正在执行，请稍后重试"), {
        statusCode: 409,
        code: "MAINTENANCE_BUSY"
      });
    this.requests.add(id);
  }
  leaveRequest(id: string) {
    this.requests.delete(id);
  }
  acquire(owner: string) {
    if (this.owner || this.requests.size)
      throw Object.assign(new Error("有操作正在执行，请等待空闲后重试"), { statusCode: 409, code: "DIAGNOSTICS_BUSY" });
    this.owner = owner;
    return () => {
      if (this.owner === owner) this.owner = undefined;
    };
  }
}
