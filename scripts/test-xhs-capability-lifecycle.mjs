/** 中文模块说明：用本地或 GitHub 已签名 Release 资产验收小红书能力生命周期与数据保留。 */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ComponentManager } from "../backend/src/modules/components/component-manager.ts";
import { createDesktopComponentSelfTest } from "../backend/src/modules/components/desktop-component-self-test.ts";
import { packagedComponentCatalog } from "../backend/src/modules/components/catalog.generated.ts";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPONENT_FEED = path.join(REPOSITORY_ROOT, ".package", "component-feed");
const COMPONENT_IDS = ["python-312", "xhs-archive", "xhs-translation", "xhs-browser"];
const online = process.argv.includes("--online");

if (process.platform !== "win32" || process.arch !== "x64") {
  throw new Error("小红书能力生命周期闭环验收必须在 Windows x64 上运行");
}
console.log(online ? "在线验收：从签名清单引用的 GitHub Release 下载能力包" : "离线验收：从本地签名 feed 安装能力包");

const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-component-e2e-"));
const dataRoot = path.join(scratch, "data");
const historySentinel = path.join(dataRoot, "xhs-archive", "history-sentinel.txt");
let manager;
let archiveWorker;

try {
  await fs.mkdir(path.dirname(historySentinel), { recursive: true });
  await fs.writeFile(historySentinel, "history must survive capability uninstall\n", "utf8");
  const managerOptions = {
    root: path.join(scratch, "components"),
    catalog: packagedComponentCatalog,
    selfTest: createDesktopComponentSelfTest(),
    availableDiskBytes: async () => 20 * 1024 * 1024 * 1024
  };
  if (!online) {
    managerOptions.downloadArchive = async (manifest, destination, options) => {
      if (options?.signal?.aborted) throw new Error("测试下载已取消");
      const filename = path.basename(new URL(manifest.archive.url).pathname);
      const source = path.join(COMPONENT_FEED, manifest.id, manifest.version, filename);
      await fs.copyFile(source, destination);
      options?.onProgress?.(manifest.archive.bytes);
    };
  }
  manager = new ComponentManager(managerOptions);

  for (const componentId of COMPONENT_IDS) {
    await runOperation("install", componentId);
    console.log(`安装并自检通过：${componentId}`);
  }

  const archivePython = await manager.resolveInstalledPython("xhs-archive");
  const archiveSource = await manager.resolveInstalledAsset("xhs-archive", "source/requirements.txt");
  const archiveSourceRoot = path.dirname(archiveSource.path);
  const volumeRoot = path.join(dataRoot, "xhs-archive", "runtime-volume");
  await runArchiveWorker(archivePython.path, archiveSourceRoot, volumeRoot);
  await assertHistoryPreserved();
  console.log("归档 Worker 回环监听、令牌校验、数据目录与退出/重启通过");

  await runTranslationSmoke();
  console.log("已安装翻译 venv 的中文→英文真实样例通过");

  for (const componentId of COMPONENT_IDS.slice(1)) {
    await runOperation("reinstall", componentId);
    console.log(`重装并自检通过：${componentId}`);
  }

  const blockedPythonRemoval = await runOperation("uninstall", "python-312", "failed");
  assert.equal(blockedPythonRemoval.errorCode, "COMPONENT_IN_USE");
  console.log("共享 Python 在依赖能力仍安装时正确阻止卸载");

  for (const componentId of ["xhs-browser", "xhs-translation", "xhs-archive", "python-312"]) {
    await runOperation("uninstall", componentId);
    await assertHistoryPreserved();
    console.log(`卸载 ${componentId} 后归档历史哨兵仍保留`);
  }

  const statuses = await manager.list();
  for (const componentId of COMPONENT_IDS) {
    assert.equal(statuses.find((status) => status.id === componentId)?.installed, false);
  }
  console.log("小红书能力签名包安装→运行→重装→卸载闭环全部通过");
} finally {
  await stopArchiveWorker();
  await fs.rm(scratch, { recursive: true, force: true });
}

async function runOperation(operation, componentId, expectedState = "completed") {
  const job =
    operation === "install"
      ? await manager.startInstall(componentId)
      : operation === "reinstall"
        ? await manager.startReinstall(componentId)
        : await manager.startUninstall(componentId);
  const deadline = Date.now() + 60 * 60 * 1000;
  while (Date.now() < deadline) {
    const current = await manager.getJob(job.id);
    if (["completed", "failed", "cancelled"].includes(current.state)) {
      assert.equal(
        current.state,
        expectedState,
        `${operation} ${componentId} 失败：${current.errorCode ?? current.errorMessage ?? current.state}`
      );
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${operation} ${componentId} 等待超时`);
}

async function runArchiveWorker(pythonPath, sourceRoot, volumeRoot) {
  const port = await reserveLoopbackPort();
  const token = "stage6-local-e2e-token";
  const workerPath = path.join(REPOSITORY_ROOT, "scripts", "xhs-provider-worker.py");
  archiveWorker = spawn(pythonPath, [workerPath], {
    cwd: sourceRoot,
    env: {
      ...process.env,
      PYTHONNOUSERSITE: "1",
      XHS_SOURCE_DIR: sourceRoot,
      XHS_VOLUME_DIR: volumeRoot,
      XHS_PROVIDER_PORT: String(port),
      XHS_PROVIDER_TOKEN: token
    },
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true
  });
  let stderr = "";
  archiveWorker.stderr?.on("data", (chunk) => {
    stderr = `${stderr}${String(chunk)}`.slice(-4000);
  });
  const child = archiveWorker;
  const deadline = Date.now() + 30_000;
  let healthy = false;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`归档 Worker 提前退出：${stderr || child.exitCode}`);
    try {
      const unauthorized = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(500)
      });
      if (unauthorized.status !== 401) throw new Error("归档 Worker 未拒绝无令牌请求");
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { "x-toolbox-worker-token": token },
        signal: AbortSignal.timeout(1_000)
      });
      if (response.ok && (await response.json()).status === "ok") {
        healthy = true;
        break;
      }
    } catch (error) {
      if (error instanceof Error && error.message === "归档 Worker 未拒绝无令牌请求") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!healthy) throw new Error(`归档 Worker 未通过回环健康检查：${stderr}`);
  await fs.access(volumeRoot);
  await stopArchiveWorker();

  // Relaunch once to verify the installed package can start cleanly after shutdown.
  const nextPort = await reserveLoopbackPort();
  archiveWorker = spawn(pythonPath, [workerPath], {
    cwd: sourceRoot,
    env: {
      ...process.env,
      PYTHONNOUSERSITE: "1",
      XHS_SOURCE_DIR: sourceRoot,
      XHS_VOLUME_DIR: volumeRoot,
      XHS_PROVIDER_PORT: String(nextPort),
      XHS_PROVIDER_TOKEN: token
    },
    stdio: "ignore",
    windowsHide: true
  });
  const restartDeadline = Date.now() + 30_000;
  let restarted = false;
  while (Date.now() < restartDeadline) {
    if (archiveWorker.exitCode !== null) throw new Error("归档 Worker 重启后提前退出");
    try {
      const response = await fetch(`http://127.0.0.1:${nextPort}/health`, {
        headers: { "x-toolbox-worker-token": token },
        signal: AbortSignal.timeout(1_000)
      });
      if (response.ok && (await response.json()).status === "ok") {
        restarted = true;
        break;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
  }
  if (!restarted) throw new Error("归档 Worker 未能在退出后重新启动");
  await stopArchiveWorker();
}

async function runTranslationSmoke() {
  const python = await manager.resolveInstalledPython("xhs-translation");
  const worker = await manager.resolveInstalledAsset("xhs-translation", "scripts/xhs-translation-worker.py");
  const model = await manager.resolveInstalledAsset("xhs-translation", "model/manifest.json");
  const smokeScript = path.join(REPOSITORY_ROOT, "scripts", "test-xhs-translation-smoke.mjs");
  const output = execFileSync(
    process.execPath,
    [smokeScript, "--python", python.path, "--worker", worker.path, "--model", path.dirname(model.path)],
    { cwd: REPOSITORY_ROOT, encoding: "utf8", timeout: 180_000, windowsHide: true }
  );
  const result = JSON.parse(output.trim().split(/\r?\n/).at(-1) ?? "{}");
  assert.match(result.translation, /Hello, this is a little red book offline translation test/i);
}

async function assertHistoryPreserved() {
  assert.equal(await fs.readFile(historySentinel, "utf8"), "history must survive capability uninstall\n");
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("无法分配回环端口");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function stopArchiveWorker() {
  const child = archiveWorker;
  archiveWorker = undefined;
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("归档 Worker 退出超时")), 10_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}
