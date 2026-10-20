type StageSource = {
  on(event: "message", listener: (message: { type?: string; stage?: string }) => void): unknown;
  removeListener(event: "message", listener: (message: { type?: string; stage?: string }) => void): unknown;
};

/** 阶段超时与总超时同时生效；重复、倒序、未知阶段不能延长退出期限。 */
export function waitForGracefulShutdown(source: StageSource, exit: Promise<void>) {
  const phases = ["tasks", "workers", "database"];
  const budgets = [15_000, 10_000, 5000];
  let index = 0;
  let stageTimer: NodeJS.Timeout;
  let totalTimer: NodeJS.Timeout;
  return new Promise<boolean>((resolve) => {
    const finish = (exited: boolean) => {
      clearTimeout(stageTimer);
      clearTimeout(totalTimer);
      source.removeListener("message", onStage);
      resolve(exited);
    };
    const onStage = (message: { type?: string; stage?: string }) => {
      if (message.type !== "shutdown-stage") return;
      const next = phases.indexOf(message.stage || "");
      if (next <= index) return;
      index = next;
      clearTimeout(stageTimer);
      stageTimer = setTimeout(() => finish(false), budgets[index]);
    };
    source.on("message", onStage);
    stageTimer = setTimeout(() => finish(false), budgets[0]);
    totalTimer = setTimeout(() => finish(false), 30_000);
    void exit.then(() => finish(true));
  });
}
