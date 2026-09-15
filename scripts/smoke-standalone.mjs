/**
 * 中文模块说明：工程与 Worker 脚本，负责 构建产物启动、健康检查和传输冒烟
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const packageRoot = path.resolve(process.argv[2] || ".");
const storageRoot = path.join(packageRoot, ".smoke-storage");
const environment = {
  ...process.env,
  DEPLOYMENT_MODE: "local",
  API_HOST: "127.0.0.1",
  API_PORT: "3100",
  STORAGE_ROOT: storageRoot
};
const children = [];

try {
  children.push(spawnPnpm(["--filter", "backend", "start"]));
  await waitForUrl("http://127.0.0.1:3100/health/ready");

  children.push(spawnPnpm(["--filter", "frontend", "preview"]));
  await waitForUrl("http://127.0.0.1:4173/");

  const form = new FormData();
  form.append("file", new Blob(["standalone smoke"], { type: "text/plain" }), "smoke.txt");
  const uploaded = await fetch("http://127.0.0.1:3100/api/v1/tools/lan-transfer/files", {
    method: "POST",
    body: form
  });
  if (!uploaded.ok) throw new Error(`Upload smoke failed: ${uploaded.status} ${await uploaded.text()}`);
  const uploadData = (await uploaded.json()).data;
  const record = uploadData.file;

  const downloaded = await fetch(`http://127.0.0.1:3100${uploadData.downloadUrl}`);
  if (!downloaded.ok || (await downloaded.text()) !== "standalone smoke") {
    throw new Error("Download smoke returned unexpected content");
  }
  const removed = await fetch(`http://127.0.0.1:3100/api/v1/tools/lan-transfer/files/${record.id}`, {
    method: "DELETE"
  });
  if (!removed.ok) throw new Error(`Cleanup smoke failed: ${removed.status}`);
  console.log("Standalone smoke passed: install, build, API/UI startup, health, upload, download and cleanup.");
} finally {
  await Promise.all(children.reverse().map(terminateChild));
  await fs.rm(storageRoot, { recursive: true, force: true }).catch(() => undefined);
}

function spawnPnpm(args) {
  const options = { cwd: packageRoot, env: environment, stdio: "pipe" };
  return process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "pnpm.cmd", ...args], options)
    : spawn("pnpm", args, options);
}

function terminateChild(child) {
  if (!child.pid || child.exitCode !== null) return Promise.resolve();
  if (process.platform !== "win32") {
    child.kill("SIGTERM");
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true
    });
    killer.once("error", () => resolve());
    killer.once("exit", () => resolve());
  });
}

async function waitForUrl(url) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}
