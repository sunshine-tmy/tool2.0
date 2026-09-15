/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

/**
 * 将已完成的文件提交到目标路径。
 * staging 文件必须和目标文件位于同一目录，这样 rename 才能在本地文件系统
 * 中保持原子性；先 fsync 文件、再同步目录，则可以降低突然断电后出现半写入的风险。
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
    // Windows 不允许以文件句柄方式打开目录执行 fsync；此时仍保留文件同步和
    // 原子 rename，它们是跨平台可用的最强持久化保证。
  }
}
