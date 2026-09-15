import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { XhsRuntimeManager } from "../modules/xhs-archive/runtime";
import { XHS_COMMIT, XhsRuntimeInstallGateway } from "../modules/xhs-archive/runtime-install-gateway";

let runtimeDir = "";

afterEach(async () => {
  delete process.env.XHS_RUNTIME_DIR;
  if (runtimeDir) await fs.rm(runtimeDir, { recursive: true, force: true });
});

describe("xhs runtime validation", () => {
  it("does not treat a virtual environment without pyvenv.cfg as installed", async () => {
    runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-runtime-"));
    process.env.XHS_RUNTIME_DIR = runtimeDir;
    const executable = path.join(
      runtimeDir,
      "venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
    );
    await fs.mkdir(path.dirname(executable), { recursive: true });
    await fs.writeFile(executable, "");
    await fs.writeFile(path.join(runtimeDir, ".installed-commit"), "afaf2fb459980fccef9eec74e304a39af2c49cab\n");

    expect(new XhsRuntimeManager(getConfig()).getStatus().status).toBe("not-installed");

    await fs.writeFile(path.join(runtimeDir, "venv", "pyvenv.cfg"), "version = 3.12.11\n");
    expect(new XhsRuntimeManager(getConfig()).getStatus()).toMatchObject({ status: "ready", installProgress: 100 });
  });

  it("records a source digest and rejects a changed pinned source", async () => {
    runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-runtime-"));
    process.env.XHS_RUNTIME_DIR = runtimeDir;
    const sourceDir = path.join(runtimeDir, `XHS-Downloader-${XHS_COMMIT}`);
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, "LICENSE"), "license");
    await fs.writeFile(path.join(sourceDir, "requirements.txt"), "fastapi==0.116.1\n");
    const gateway = new XhsRuntimeInstallGateway(getConfig(), () => undefined);

    await gateway.validateExistingSource();
    await expect(fs.readFile(path.join(runtimeDir, ".source-sha256"), "utf8")).resolves.toMatch(/^[a-f0-9]{64}\n$/);

    await fs.writeFile(path.join(sourceDir, "requirements.txt"), "fastapi==0.116.2\n");
    await expect(gateway.validateExistingSource()).rejects.toThrow("固定版本源码摘要校验失败");
  });
});
