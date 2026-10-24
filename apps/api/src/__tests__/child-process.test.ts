/**
 * 中文模块说明：测试 apps/api/src/__tests__/child-process.test.ts 中的稳定行为、边界条件和回归场景
 */
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { terminateChildProcess } from "../lifecycle/child-process";

describe("child process lifecycle", () => {
  it("does not treat a successful kill call as a confirmed process exit", async () => {
    const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill: vi.fn(() => true) });
    await expect(terminateChildProcess(child as unknown as ChildProcess, 20)).rejects.toMatchObject({
      code: "CHILD_EXIT_UNCONFIRMED"
    });
    expect(child.kill).toHaveBeenCalledTimes(2);
  });
  it("waits for a worker process to exit", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], {
      stdio: "ignore",
      windowsHide: true
    });
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });

    await terminateChildProcess(child, 2_000);

    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  });
});
