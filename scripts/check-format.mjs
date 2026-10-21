/** 只把 Git 纳入项目的文件交给 Prettier，避免不可读的本机缓存阻断格式门禁。 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const prettierCli = fileURLToPath(new URL("../node_modules/prettier/bin/prettier.cjs", import.meta.url));
const MAX_BATCH_CHARS = 12_000;

export function listProjectFiles({ list = execFileSync, exists = existsSync } = {}) {
  const output = list("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: workspaceRoot,
    maxBuffer: 8 * 1024 * 1024
  });
  return (
    output
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map((file) => path.resolve(workspaceRoot, file))
      // 尚未提交的删除仍会出现在 Git 索引中，不应作为 Prettier 的输入。
      .filter((file) => exists(file))
  );
}

export function createBatches(files, maxChars = MAX_BATCH_CHARS) {
  const batches = [];
  let batch = [];
  let length = 0;

  for (const file of files) {
    const nextLength = file.length + 1;
    if (batch.length > 0 && length + nextLength > maxChars) {
      batches.push(batch);
      batch = [];
      length = 0;
    }
    batch.push(file);
    length += nextLength;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

export function main() {
  const files = listProjectFiles();
  const batches = createBatches(files);
  if (files.length === 0) {
    process.stdout.write("没有待检查的 Git 项目文件。\n");
    return;
  }

  for (const [index, batch] of batches.entries()) {
    const result = spawnSync(process.execPath, [prettierCli, "--check", "--ignore-unknown", ...batch], {
      cwd: workspaceRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) {
      process.stderr.write(`Prettier 第 ${index + 1} 批启动失败：${result.error.message}\n`);
      process.exitCode = result.error.code === "ENOENT" ? 127 : 1;
      return;
    }
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
