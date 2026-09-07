import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const targets = new Set();

const fixedTargets = [
  ".logs",
  ".package",
  ".tmp",
  "backend/dist",
  "backend/storage",
  "coverage",
  "frontend/dist",
  "packages/shared/dist",
  "storage"
];

const ignoredDirectories = new Set([".git", ".venv", "lan-file-transfer-standalone", "models", "node_modules", "venv"]);

const cacheDirectoryNames = new Set([".cache", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".vite", "__pycache__"]);

function isIgnoredDirectory(name) {
  return ignoredDirectories.has(name) || name.startsWith(".venv-");
}

function relativePath(absolutePath) {
  return path.relative(repoRoot, absolutePath) || ".";
}

function addTarget(relativeTarget) {
  targets.add(path.resolve(repoRoot, relativeTarget));
}

async function findNestedCaches(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (isIgnoredDirectory(entry.name)) return;
        if (cacheDirectoryNames.has(entry.name) || entry.name === "coverage") {
          targets.add(entryPath);
          return;
        }
        await findNestedCaches(entryPath);
        return;
      }

      if (entry.isFile() && (entry.name.endsWith(".log") || entry.name.endsWith(".tsbuildinfo"))) {
        targets.add(entryPath);
      }
    })
  );
}

function removeNestedTargets(paths) {
  return paths.filter(
    (candidate) => !paths.some((parent) => parent !== candidate && candidate.startsWith(`${parent}${path.sep}`))
  );
}

for (const target of fixedTargets) addTarget(target);
await findNestedCaches(repoRoot);

const cleanupTargets = removeNestedTargets([...targets]).sort((left, right) => left.localeCompare(right));

console.log(dryRun ? "将清理以下生成内容：" : "正在清理以下生成内容：");
for (const target of cleanupTargets) console.log(`- ${relativePath(target)}`);

if (dryRun) {
  console.log("演练完成：未删除任何文件。");
  process.exit(0);
}

await Promise.all(cleanupTargets.map((target) => rm(target, { recursive: true, force: true })));

for (const relativeKeepFile of [
  "storage/uploads/.gitkeep",
  "storage/outputs/.gitkeep",
  "storage/temp/.gitkeep",
  "storage/lan-transfer/files/.gitkeep"
]) {
  const keepFile = path.join(repoRoot, relativeKeepFile);
  await mkdir(path.dirname(keepFile), { recursive: true });
  await writeFile(keepFile, "");
}

console.log("清理完成：依赖、Python 虚拟环境、模型和 .env 配置均已保留。");
