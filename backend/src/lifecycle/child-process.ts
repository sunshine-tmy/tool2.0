/**
 * 中文模块说明：后端生命周期层，负责进程、队列、Worker 与资源的安全启停
 */
import type { ChildProcess } from "node:child_process";

export async function terminateChildProcess(child: ChildProcess, timeoutMs = 3_000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill();
  if (await waitForExit(exited, timeoutMs)) return;
  child.kill("SIGKILL");
  await waitForExit(exited, Math.min(timeoutMs, 1_000));
}

async function waitForExit(exited: Promise<void>, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref();
  });
  const result = await Promise.race([exited.then(() => true as const), timedOut]);
  if (timer) clearTimeout(timer);
  return result;
}
