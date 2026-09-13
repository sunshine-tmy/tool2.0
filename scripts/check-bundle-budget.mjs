import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const dist = path.resolve("frontend/dist");
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
