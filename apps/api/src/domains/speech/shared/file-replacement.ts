/** Backup/restore replacement, intentionally distinct from durable staged-file commits. */
import fsp from "node:fs/promises";

export async function replaceFile(source: string, target: string) {
  const backup = `${target}.backup`;
  await fsp.rm(backup, { force: true });
  const hadTarget = await fileExists(target);
  if (hadTarget) await fsp.rename(target, backup);
  try {
    await fsp.rename(source, target);
    await fsp.rm(backup, { force: true });
  } catch (error) {
    if (hadTarget && (await fileExists(backup))) await fsp.rename(backup, target);
    throw error;
  }
}

export async function fileExists(filePath: string) {
  return fsp.stat(filePath).then(
    (stat) => stat.isFile(),
    () => false
  );
}
