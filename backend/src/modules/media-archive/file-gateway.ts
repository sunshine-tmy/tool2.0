/** 归档文件网关：校验并 fsync staging，准备最终路径的文件索引；目录替换失败保留可恢复备份。 */
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { ContentArchiveItem } from "@toolbox/shared";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { FileMetadata } from "../../database/toolbox-database";

/** 提交只接收本模块创建的 staging 子目录，不把任意磁盘路径当作可移动、可回滚的目标。 */
export async function assertArchiveStaging(staging: string, stagingRoot: string) {
  const [root, resolved, stat] = await Promise.all([fs.realpath(stagingRoot), fs.realpath(staging), fs.lstat(staging)]);
  const relative = path.relative(root, resolved);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    !stat.isDirectory() ||
    stat.isSymbolicLink()
  )
    throw new Error("ARCHIVE_STAGING_PATH_INVALID");
}

export async function inspectArchiveFiles(
  repository: FileMetadataRepository,
  item: ContentArchiveItem,
  staging: string,
  target: string
): Promise<FileMetadata[]> {
  const files: FileMetadata[] = [
    await repository.inspect(
      {
        entityKind: "xhs-archive",
        entityId: item.id,
        filePath: path.join(target, "manifest.json"),
        mediaType: "application/json",
        owner: "local"
      },
      path.join(staging, "manifest.json")
    )
  ];
  for (const media of item.media) {
    if (
      path.posix.basename(media.fileName) !== media.fileName ||
      path.win32.basename(media.fileName) !== media.fileName ||
      media.fileName.includes(":") ||
      media.fileName === "." ||
      media.fileName === ".."
    )
      throw new Error("ARCHIVE_MEDIA_PATH_INVALID");
    const source = path.join(staging, media.fileName);
    const handle = await fs.open(source, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    const file = await repository.inspect(
      {
        entityKind: "xhs-media",
        entityId: media.id,
        filePath: path.join(target, media.fileName),
        mediaType: media.mimeType,
        owner: "local"
      },
      source
    );
    if (file.byteSize !== media.size || file.sha256 !== media.checksum)
      throw new Error("ARCHIVE_MEDIA_INTEGRITY_FAILED");
    files.push(file);
  }
  return files;
}

/** 数据库提交回调须是单事务；只有成功返回后才清理旧目录，恢复失败的备份绝不永久删除。 */
export async function replaceArchiveDirectory(staging: string, target: string, commit: () => Promise<void>) {
  const backup = `${target}.previous`;
  if (await exists(backup)) throw new Error("ARCHIVE_RECOVERY_REQUIRED");
  let movedOld = false;
  let movedNew = false;
  try {
    if (await exists(target)) {
      await fs.rename(target, backup);
      movedOld = true;
    }
    await fs.rename(staging, target);
    movedNew = true;
    await commit();
  } catch (error) {
    if (movedNew) await fs.rm(target, { recursive: true, force: true });
    if (movedOld) await fs.rename(backup, target);
    throw error;
  }
  // 数据库已提交后，只保留清理失败的备份；下一次刷新会明确要求恢复，不把新库和旧文件重新混合。
  if (movedOld) await fs.rm(backup, { recursive: true, force: true }).catch(() => undefined);
}

/** 更新清单时先保留旧副本；索引与领域记录由回调一起提交，数据库失败恢复原清单。 */
export async function replaceArchiveManifest(
  directory: string,
  item: ContentArchiveItem,
  commit: (manifestPath: string) => Promise<void>
) {
  const manifest = path.join(directory, "manifest.json");
  const token = nanoid(12);
  const temporary = path.join(directory, `.${token}.manifest.staging`);
  const backup = path.join(directory, `.${token}.manifest.previous`);
  let replaced = false;
  let backedUp = false;
  try {
    const handle = await fs.open(temporary, "wx");
    try {
      await handle.writeFile(`${JSON.stringify(item, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.copyFile(manifest, backup);
    backedUp = true;
    await fs.rename(temporary, manifest);
    replaced = true;
    await commit(manifest);
  } catch (error) {
    // 恢复失败时保留备份供人工恢复，不能吞掉错误后继续清理它。
    if (replaced) await fs.rename(backup, manifest);
    else if (backedUp) await fs.rm(backup, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
  await fs.rm(backup, { force: true }).catch(() => undefined);
}

async function exists(file: string) {
  return fs.access(file).then(
    () => true,
    () => false
  );
}
