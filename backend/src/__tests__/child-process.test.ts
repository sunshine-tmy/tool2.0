/**
 * 中文模块说明：测试 backend/src/__tests__/child-process.test.ts 中的稳定行为、边界条件和回归场景
 */
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { terminateChildProcess } from "../lifecycle/child-process";

describe("child process lifecycle", () => {
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
