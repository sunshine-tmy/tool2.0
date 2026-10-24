// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/check-bundle-budget.mjs", import.meta.url).href;

/**
 * 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../apps/web/dist", publicEntryUrl));
const manifestPath = path.join(dist, ".vite", "manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error("Vite manifest not found; run pnpm build:web first");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const ENTRY_LIMIT = 150 * 1024;
const LAZY_LIMIT = 75 * 1024;
const failures = [];
const measured = [];

for (const [name, chunk] of Object.entries(manifest)) {
  if (!chunk.file?.endsWith(".js")) continue;
  const contents = fs.readFileSync(path.join(dist, chunk.file));
  const gzipBytes = zlib.gzipSync(contents, { level: 9 }).length;
  const limit = chunk.isEntry ? ENTRY_LIMIT : LAZY_LIMIT;
  measured.push({ name, file: chunk.file, gzipBytes, limit });
  if (gzipBytes > limit) failures.push(`${chunk.file}: ${gzipBytes} > ${limit} gzip bytes`);
}

measured.sort((left, right) => right.gzipBytes - left.gzipBytes);
console.table(measured);
if (failures.length) throw new Error(`Bundle budget exceeded:\n${failures.join("\n")}`);
