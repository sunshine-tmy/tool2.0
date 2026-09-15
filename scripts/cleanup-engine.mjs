/**
 * 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
 */
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

export async function inspectCleanupCategories(ids) {
  const selected = ids ? new Set(ids) : undefined;
  return Promise.all(
    cleanupDefinitions
      .filter((definition) => !selected || selected.has(definition.id))
      .map(async (definition) => {
        const targets = await targetsFor(definition);
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
  const selected = new Set(ids);
  const unknown = [...selected].filter((id) => !cleanupDefinitions.some((definition) => definition.id === id));
  if (unknown.length) throw new Error(`未知清理分类：${unknown.join(", ")}`);
  const results = [];
  for (const definition of cleanupDefinitions.filter((entry) => selected.has(entry.id))) {
    const targets = await targetsFor(definition);
    const before = await Promise.all(targets.map((target) => inspectPath(target)));
    if (!options.dryRun) {
      for (const target of targets) await rm(target, { recursive: true, force: true });
      await restoreKeepFiles(definition.id);
    }
    results.push({
      id: definition.id,
      label: definition.label,
      files: before.reduce((sum, value) => sum + value.files, 0),
      bytes: before.reduce((sum, value) => sum + value.bytes, 0)
    });
  }
  return results;
}

async function targetsFor(definition) {
  const targets = definition.targets.map(resolveTarget);
  if (definition.id !== "dev-cache" && definition.id !== "logs") return uniqueParents(targets);
  await discoverGenerated(repoRoot, definition.id, targets);
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

function resolveTarget(relative) {
  const absolute = path.resolve(repoRoot, relative);
  if (absolute !== repoRoot && !absolute.startsWith(`${repoRoot}${path.sep}`)) throw new Error("清理路径超出项目目录");
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

async function restoreKeepFiles(id) {
  const files = [];
  if (id === "image-compress") files.push("storage/uploads/.gitkeep", "storage/outputs/.gitkeep");
  if (id === "lan-transfer") files.push("storage/lan-transfer/files/.gitkeep");
  for (const relative of files) {
    const target = resolveTarget(relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "");
  }
}
