import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { AudioLibraryCatalog } from "@toolbox/shared";
import { writeAtomicFile } from "../../storage/file-commit-gateway";
import { reject } from "./errors";

// Only operate on the supplied draft; queue, pins, commit and lifecycle remain owned by the store.
export function setAudioLibraryTrashState(c: AudioLibraryCatalog, ids: string[], restore = false) {
  for (const id of ids) {
    const item = c.items.find((x) => x.id === id) ?? reject("AUDIO_LIBRARY_NOT_FOUND", "素材不存在", 404);
    item.deletedAt = restore ? undefined : new Date().toISOString();
    item.revision++;
    item.updatedAt = new Date().toISOString();
  }
}

export function stageAudioLibraryPurge(c: AudioLibraryCatalog, id: string, pinned: boolean) {
  if (pinned) reject("AUDIO_LIBRARY_BUSY", "素材正在导出，请稍后再删除", 409);
  const item = c.items.find((x) => x.id === id);
  if (!item?.deletedAt) reject("AUDIO_LIBRARY_NOT_IN_TRASH", "请先将素材移入回收站");
  c.items = c.items.filter((x) => x.id !== id);
  c.pendingDeletes.push({ id, bytes: item.bytes });
}

export async function collectAudioLibraryGarbage(root: string, getCatalog: () => AudioLibraryCatalog) {
  for (const entry of [...getCatalog().pendingDeletes]) {
    try {
      await fs.rm(path.join(root, "items", entry.id), { recursive: true, force: true });
    } catch {
      continue;
    }
    // 文件已删除，清单即使尚未更新也只会暂时多计空间，重启可再次清理。
    getCatalog().pendingDeletes = getCatalog().pendingDeletes.filter((x) => x.id !== entry.id);
  }
  await writeAtomicFile(path.join(root, "library.json"), JSON.stringify(getCatalog()), nanoid());
}
