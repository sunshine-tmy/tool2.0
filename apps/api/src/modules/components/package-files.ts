import fsp from "node:fs/promises";
import path from "node:path";
import { ComponentManagerError } from "./component-error";
export async function listRegularFiles(
  root: string
): Promise<Array<{ path: string; fullPath: string; bytes: number; mode: number }>> {
  const files: Array<{ path: string; fullPath: string; bytes: number; mode: number }> = [];
  async function walk(directory: string, prefix: string) {
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? prefix + "/" + entry.name : entry.name;
      const fullPath = path.join(directory, entry.name);
      const stat = await fsp.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包解压结果包含链接");
      if (stat.isDirectory()) await walk(fullPath, relative);
      else if (stat.isFile()) files.push({ path: relative, fullPath, bytes: stat.size, mode: stat.mode });
      else throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "能力包解压结果包含不支持的文件类型");
    }
  }
  await walk(root, "");
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function cleanPartialFiles(root: string) {
  for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.name.endsWith(".partial")) await fsp.rm(candidate, { recursive: true, force: true });
    else if (entry.isDirectory()) await cleanPartialFiles(candidate);
  }
}

export async function getAvailableDiskBytes(root: string) {
  await fsp.mkdir(root, { recursive: true });
  const stats = await fsp.statfs(root);
  return Number(stats.bavail) * Number(stats.bsize);
}

export function pathExists(candidate: string) {
  return fsp.access(candidate).then(
    () => true,
    () => false
  );
}
