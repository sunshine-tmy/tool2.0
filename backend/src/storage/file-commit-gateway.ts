import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

/**
 * Commits a completed file in the same directory as its destination.
 * A same-directory rename is atomic on the supported local filesystems, while
 * syncing the file first makes the commit durable across a sudden restart.
 */
export async function commitStagedFile(stagingPath: string, targetPath: string) {
  const stagingDirectory = path.resolve(path.dirname(stagingPath));
  const targetDirectory = path.resolve(path.dirname(targetPath));
  if (stagingDirectory !== targetDirectory) throw new Error("Staging file must share the target directory");
  await syncFile(stagingPath);
  await fsp.rename(stagingPath, targetPath);
  await syncDirectory(targetDirectory);
}

export function createStagingPath(targetPath: string, token: string) {
  const name = path.basename(targetPath);
  return path.join(path.dirname(targetPath), `.${name}.staging-${token}`);
}

export async function writeAtomicFile(
  targetPath: string,
  source: Buffer | string | Readable,
  token: string
) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  const stagingPath = createStagingPath(targetPath, token);
  try {
    if (typeof source === "string" || Buffer.isBuffer(source)) {
      await fsp.writeFile(stagingPath, source, { flag: "wx" });
    } else {
      await pipeline(source, fs.createWriteStream(stagingPath, { flags: "wx" }));
    }
    await commitStagedFile(stagingPath, targetPath);
  } catch (error) {
    await fsp.rm(stagingPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function syncFile(filePath: string) {
  const handle = await fsp.open(filePath, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directory: string) {
  try {
    const handle = await fsp.open(directory, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Windows does not allow opening directories for fsync. The file sync and
    // atomic rename still provide the strongest portable guarantee available.
  }
}
