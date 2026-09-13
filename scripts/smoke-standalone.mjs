import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const packageRoot = path.resolve(process.argv[2] || ".");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
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
  children.push(spawn(pnpm, ["--filter", "backend", "start"], { cwd: packageRoot, env: environment, stdio: "pipe" }));
  await waitForUrl("http://127.0.0.1:3100/health/ready");

  children.push(
    spawn(pnpm, ["--filter", "frontend", "preview"], { cwd: packageRoot, env: environment, stdio: "pipe" })
  );
  await waitForUrl("http://127.0.0.1:4173/");

  const form = new FormData();
  form.append("file", new Blob(["standalone smoke"], { type: "text/plain" }), "smoke.txt");
  const uploaded = await fetch("http://127.0.0.1:3100/api/v1/tools/lan-transfer/files", {
    method: "POST",
    body: form
  });
  if (!uploaded.ok) throw new Error(`Upload smoke failed: ${uploaded.status} ${await uploaded.text()}`);
  const record = (await uploaded.json()).data.file;

  const downloaded = await fetch(`http://127.0.0.1:3100${record.downloadUrl}`);
  if (!downloaded.ok || (await downloaded.text()) !== "standalone smoke") {
    throw new Error("Download smoke returned unexpected content");
  }
  const removed = await fetch(`http://127.0.0.1:3100/api/v1/tools/lan-transfer/files/${record.id}`, {
    method: "DELETE"
  });
  if (!removed.ok) throw new Error(`Cleanup smoke failed: ${removed.status}`);
  console.log("Standalone smoke passed: install, build, API/UI startup, health, upload, download and cleanup.");
} finally {
  for (const child of children.reverse()) child.kill("SIGTERM");
  await fs.rm(storageRoot, { recursive: true, force: true }).catch(() => undefined);
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
