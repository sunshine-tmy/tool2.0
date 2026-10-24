/**
 * 中文模块说明：局域网文件与图文传输领域，负责上传、分片、预览、下载和清理
 */
import fsp from "node:fs/promises";

export async function ensureJsonIndex(indexPath: string) {
  const backupPath = `${indexPath}.bak`;
  try {
    await fsp.access(indexPath);
    return;
  } catch {
    try {
      await fsp.copyFile(backupPath, indexPath);
      return;
    } catch {
      await fsp.writeFile(indexPath, "[]");
    }
  }
}

export async function readJsonIndex(indexPath: string) {
  await ensureJsonIndex(indexPath);
  return fsp.readFile(indexPath, "utf8");
}
