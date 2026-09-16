/**
 * 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
 */
import { mkdir, readdir, rm, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 运行中的进程可能独占锁定日志等文件，删除时命中这些错误码需要跳过而非整体失败。
const LOCK_CODES = new Set(["EBUSY", "EPERM", "EACCES", "ENOTEMPTY"]);

export const cleanupDefinitions = [
  {
    id: "build",
    label: "构建产物",
    risk: "low",
    requiresStop: false,
    defaults: true,
    targets: ["backend/dist", "frontend/dist", "packages/shared/dist", "coverage"]
  },
  {
    id: "dev-cache",
    label: "开发缓存",
    risk: "low",
    requiresStop: false,
    defaults: true,
    targets: [".tmp", "backend/.vite", "frontend/.vite"]
  },
  { id: "logs", label: "日志", risk: "low", requiresStop: false, defaults: true, targets: [".logs"] },
  { id: "temp", label: "临时文件", risk: "low", requiresStop: false, defaults: true, targets: ["storage/temp"] },
  { id: "packages", label: "打包产物", risk: "low", requiresStop: false, defaults: true, targets: [".package"] },
  {
    id: "image-compress",
    label: "图片压缩运行数据",
    risk: "medium",
    requiresStop: false,
    defaults: false,
    targets: ["storage/uploads", "storage/outputs"]
  },
  {
    id: "image-ai",
    label: "AI 图片处理运行数据",
    risk: "medium",
    requiresStop: true,
    defaults: false,
    targets: ["storage/image-ai"]
  },
  {
    id: "lan-transfer",
    label: "局域网传输数据",
    risk: "medium",
    requiresStop: true,
    defaults: false,
    targets: ["storage/lan-transfer"]
  },
  {
    id: "video-text",
    label: "视频文案运行数据",
    risk: "medium",
    requiresStop: true,
    defaults: false,
    targets: ["storage/video-text"]
  },
  {
    id: "voice",
    label: "多国语言配音运行数据",
    risk: "medium",
    requiresStop: true,
    defaults: false,
    targets: ["storage/edge-tts", "storage/chatterbox"]
  },
  {
    id: "short-video",
    label: "短视频解析缓存",
    risk: "low",
    requiresStop: false,
    defaults: false,
    targets: ["storage/short-video"]
  },
  {
    id: "xhs-temp",
    label: "小红书临时数据",
    risk: "low",
    requiresStop: false,
    defaults: true,
    targets: ["storage/xhs-archive/staging", ".runtime/xhs-downloader/cache", ".runtime/xhs-translation-model-cache"]
  },
  {
    id: "xhs-archive",
    label: "小红书永久存档",
    risk: "high",
    requiresStop: true,
    defaults: false,
    targets: ["storage/xhs-archive/items", "storage/xhs-archive/index.json", "storage/xhs-archive/index.json.bak"]
  }
];

export async function inspectCleanupCategories(ids, root = repoRoot) {
  const selected = ids ? new Set(ids) : undefined;
  return Promise.all(
    cleanupDefinitions
      .filter((definition) => !selected || selected.has(definition.id))
      .map(async (definition) => {
        const targets = await targetsFor(definition, root);
        const totals = await Promise.all(targets.map((target) => inspectPath(target)));
        return {
          id: definition.id,
          label: definition.label,
          risk: definition.risk,
          requiresStop: definition.requiresStop,
          defaults: definition.defaults,
          files: totals.reduce((sum, value) => sum + value.files, 0),
          bytes: totals.reduce((sum, value) => sum + value.bytes, 0)
        };
      })
  );
}

export async function executeCleanup(ids, options = {}) {
  const root = options.root ?? repoRoot;
  const selected = new Set(ids);
  const unknown = [...selected].filter((id) => !cleanupDefinitions.some((definition) => definition.id === id));
  if (unknown.length) throw new Error(`未知清理分类：${unknown.join(", ")}`);
  const results = [];
  for (const definition of cleanupDefinitions.filter((entry) => selected.has(entry.id))) {
    const targets = await targetsFor(definition, root);
    const before = await Promise.all(targets.map((target) => inspectPath(target)));
    const skipped = [];
    if (!options.dryRun) {
      for (const target of targets) await removeWithSkips(target, skipped, options);
      await restoreKeepFiles(definition.id, root);
    }
    const beforeFiles = before.reduce((sum, value) => sum + value.files, 0);
    const beforeBytes = before.reduce((sum, value) => sum + value.bytes, 0);
    const skippedFiles = skipped.length;
    const skippedBytes = skipped.reduce((sum, value) => sum + value.bytes, 0);
    const result = {
      id: definition.id,
      label: definition.label,
      files: beforeFiles - skippedFiles,
      bytes: beforeBytes - skippedBytes
    };
    if (skippedFiles > 0) {
      result.skippedFiles = skippedFiles;
      result.skippedBytes = skippedBytes;
    }
    results.push(result);
  }
  return results;
}

// 删除单个目标：先整体删除，命中锁类错误则短暂重试后逐项跳过，非锁类错误照常抛出。
export async function removeWithSkips(target, skipped, options = {}) {
  const rmImpl = options.rmImpl ?? rm;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 300;
  const outcome = await attemptRemove(target, rmImpl, retries, retryDelayMs);
  if (outcome.ok) return;
  if (!isLockError(outcome.error)) throw outcome.error;

  const info = await stat(target).catch(() => undefined);
  if (info?.isFile()) {
    skipped.push({ path: target, bytes: info.size });
    return;
  }
  if (info?.isDirectory() || (await readdir(target, { withFileTypes: true }).catch(() => undefined))) {
    await removeChildren(target, skipped, { rmImpl, retries, retryDelayMs });
    await rmdir(target).catch(() => {});
    return;
  }
  // stat 与 readdir 均失败：无法按目录处理，按被锁文件记账（字节数不可知记 0）。
  skipped.push({ path: target, bytes: 0 });
}

async function attemptRemove(target, rmImpl, retries, retryDelayMs) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rmImpl(target, { recursive: true, force: true });
      return { ok: true };
    } catch (error) {
      if (!isLockError(error) || attempt >= retries) return { ok: false, error };
      if (retryDelayMs > 0) await delay(retryDelayMs);
    }
  }
}

async function removeChildren(directory, skipped, { rmImpl, retries, retryDelayMs }) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await removeWithSkips(child, skipped, { rmImpl, retries, retryDelayMs });
      continue;
    }
    const outcome = await attemptRemove(child, rmImpl, retries, retryDelayMs);
    if (outcome.ok) continue;
    if (!isLockError(outcome.error)) throw outcome.error;
    const info = await stat(child).catch(() => undefined);
    skipped.push({ path: child, bytes: info?.size ?? 0 });
  }
}

function isLockError(error) {
  return LOCK_CODES.has(error?.code);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function targetsFor(definition, root) {
  const targets = definition.targets.map((relative) => resolveTarget(relative, root));
  if (definition.id !== "dev-cache" && definition.id !== "logs") return uniqueParents(targets);
  await discoverGenerated(root, definition.id, targets);
  return uniqueParents(targets);
}

async function discoverGenerated(directory, category, targets) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const ignored = new Set([
    ".git",
    ".runtime",
    ".venv",
    "lan-file-transfer-standalone",
    "models",
    "node_modules",
    "venv"
  ]);
  const cacheNames = new Set([".cache", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".vite", "__pycache__"]);
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignored.has(entry.name) || entry.name.startsWith(".venv-")) continue;
      if (category === "dev-cache" && cacheNames.has(entry.name)) {
        targets.push(target);
        continue;
      }
      await discoverGenerated(target, category, targets);
    } else if (
      entry.isFile() &&
      ((category === "logs" && entry.name.endsWith(".log")) ||
        (category === "dev-cache" && entry.name.endsWith(".tsbuildinfo")))
    ) {
      targets.push(target);
    }
  }
}

function uniqueParents(paths) {
  const unique = [...new Set(paths.map((value) => path.resolve(value)))];
  return unique.filter(
    (candidate) => !unique.some((parent) => parent !== candidate && candidate.startsWith(`${parent}${path.sep}`))
  );
}

function resolveTarget(relative, root) {
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) throw new Error("清理路径超出项目目录");
  return absolute;
}

async function inspectPath(target) {
  const info = await stat(target).catch(() => undefined);
  if (!info) return { files: 0, bytes: 0 };
  if (info.isFile()) return { files: 1, bytes: info.size };
  const entries = await readdir(target, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((entry) => inspectPath(path.join(target, entry.name))));
  return {
    files: nested.reduce((sum, value) => sum + value.files, 0),
    bytes: nested.reduce((sum, value) => sum + value.bytes, 0)
  };
}

async function restoreKeepFiles(id, root) {
  const files = [];
  if (id === "image-compress") files.push("storage/uploads/.gitkeep", "storage/outputs/.gitkeep");
  if (id === "lan-transfer") files.push("storage/lan-transfer/files/.gitkeep");
  for (const relative of files) {
    const target = resolveTarget(relative, root);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "");
  }
}
