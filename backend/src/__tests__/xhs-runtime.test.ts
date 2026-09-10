import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { XhsRuntimeManager } from "../modules/xhs-archive/runtime";

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
});
