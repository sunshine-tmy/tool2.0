/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import fsp from "node:fs/promises";
import path from "node:path";

type ArchiveLimits = {
  maxEntries: number;
  maxBytes: number;
};

const RUNTIME_ARCHIVE_LIMITS: ArchiveLimits = {
  maxEntries: 10_000,
  maxBytes: 2 * 1024 * 1024 * 1024
};

/** Validate tar listing names before any archive extraction takes place. */
export function validateArchiveListing(listing: string, limits: ArchiveLimits = RUNTIME_ARCHIVE_LIMITS) {
  const entries = listing
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length > limits.maxEntries) throw new Error("归档文件数量超过安全限制");
  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/");
    const segments = normalized.split("/").filter(Boolean);
    if (path.posix.isAbsolute(normalized) || /^[A-Za-z]:\//u.test(normalized) || segments.includes("..")) {
      throw new Error("归档包含越界路径");
    }
  }
  return entries;
}

/** Check the extracted tree before it can be promoted to a live runtime. */
export async function validateExtractedDirectory(root: string, limits: ArchiveLimits = RUNTIME_ARCHIVE_LIMITS) {
  const resolvedRoot = path.resolve(root);
  const pending = [resolvedRoot];
  let fileCount = 0;
  let totalBytes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.resolve(current, entry.name);
      if (!target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("归档包含越界路径");
      if (entry.isSymbolicLink()) throw new Error("归档不允许包含符号链接");
      if (entry.isDirectory()) {
        pending.push(target);
        continue;
      }
      if (!entry.isFile()) throw new Error("归档包含不支持的文件类型");
      fileCount += 1;
      if (fileCount > limits.maxEntries) throw new Error("解压文件数量超过安全限制");
      totalBytes += (await fsp.stat(target)).size;
      if (totalBytes > limits.maxBytes) throw new Error("解压体积超过安全限制");
    }
  }
  return { fileCount, totalBytes };
}
