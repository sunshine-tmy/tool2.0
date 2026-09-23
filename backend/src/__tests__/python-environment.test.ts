/** 中文模块说明：固定 Python 运行时的离线构建安全测试。 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPythonEnvironment } from "../modules/components/python-environment";

let temporaryRoot = "";

afterEach(async () => {
  if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = "";
});

describe("buildPythonEnvironment", () => {
  it("builds the venv at its immutable final location using only a hash-locked offline wheelhouse", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-python-env-"));
    await fs.mkdir(path.join(temporaryRoot, "wheelhouse"));
    await fs.writeFile(path.join(temporaryRoot, "python.exe"), "signed test interpreter");
    const lockPath = path.join(temporaryRoot, "requirements.lock");
    const lock = "sample==1.2.3 --hash=sha256:" + "a".repeat(64) + "\n";
    await fs.writeFile(lockPath, lock);
    const invocations: Array<{ executable: string; args: string[]; cwd: string }> = [];
    const runProcess = vi.fn(async (executable: string, args: string[], cwd: string) => {
      invocations.push({ executable, args, cwd });
      return args[0] === "-c" ? "3.11\n" : "";
    });

    const result = await buildPythonEnvironment({
      packageRoot: temporaryRoot,
      pythonExecutablePath: "python.exe",
      wheelhousePath: "wheelhouse",
      requirementsLockPath: "requirements.lock",
      requirementsLockSha256: crypto.createHash("sha256").update(lock).digest("hex"),
      expectedPythonVersion: "3.11",
      runProcess
    });

    expect(result.environmentDirectory).toBe(path.join(temporaryRoot, "venv"));
    expect(invocations[1]).toMatchObject({
      args: ["-m", "venv", path.join(temporaryRoot, "venv")],
      cwd: temporaryRoot
    });
    expect(invocations[3].args).toContain("--no-index");
    expect(invocations[3].args).toContain("--require-hashes");
    expect(invocations[3].args).toContain(path.join(temporaryRoot, "wheelhouse"));
    expect(invocations[4].args).toEqual(["-m", "pip", "--isolated", "check"]);
  });

  it("rejects a changed lock file before invoking Python", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-python-env-"));
    await fs.mkdir(path.join(temporaryRoot, "wheelhouse"));
    await fs.writeFile(path.join(temporaryRoot, "python.exe"), "signed test interpreter");
    await fs.writeFile(path.join(temporaryRoot, "requirements.lock"), "changed\n");
    const runProcess = vi.fn(async () => "");

    await expect(
      buildPythonEnvironment({
        packageRoot: temporaryRoot,
        pythonExecutablePath: "python.exe",
        wheelhousePath: "wheelhouse",
        requirementsLockPath: "requirements.lock",
        requirementsLockSha256: "0".repeat(64),
        expectedPythonVersion: "3.11",
        runProcess
      })
    ).rejects.toThrow("Python 依赖锁文件摘要校验失败");
    expect(runProcess).not.toHaveBeenCalled();
  });

  it("rejects traversal and a pre-existing target rather than overwriting either", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-python-env-"));
    await fs.mkdir(path.join(temporaryRoot, "wheelhouse"));
    await fs.writeFile(path.join(temporaryRoot, "python.exe"), "signed test interpreter");
    const lock = "locked\n";
    await fs.writeFile(path.join(temporaryRoot, "requirements.lock"), lock);
    const options = {
      packageRoot: temporaryRoot,
      pythonExecutablePath: "python.exe",
      wheelhousePath: "wheelhouse",
      requirementsLockPath: "requirements.lock",
      requirementsLockSha256: crypto.createHash("sha256").update(lock).digest("hex"),
      expectedPythonVersion: "3.11" as const,
      runProcess: vi.fn(async () => "3.11")
    };

    await expect(buildPythonEnvironment({ ...options, pythonExecutablePath: "../python.exe" })).rejects.toThrow(
      "Python 解释器路径不安全"
    );
    await fs.mkdir(path.join(temporaryRoot, "venv"));
    await expect(buildPythonEnvironment(options)).rejects.toThrow("Python 环境目标目录已存在");
  });
});
