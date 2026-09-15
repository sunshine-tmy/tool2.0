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
