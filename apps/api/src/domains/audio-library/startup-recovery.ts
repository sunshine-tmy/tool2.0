import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { AudioLibraryCatalog } from "@toolbox/shared";
import { writeAtomicFile } from "../../storage/file-commit-gateway";
import { readCatalog } from "./catalog";
import { reject } from "./errors";

// File selection/repair only: the store retains validation, state ownership, mirroring and final garbage collection.
export async function recoverAudioLibraryCatalog(
  root: string,
  readPreviousItems: () => readonly unknown[]
): Promise<AudioLibraryCatalog> {
  await fs.mkdir(root, { recursive: true });
  const primary = path.join(root, "library.json");
  const read = async (name: string) => {
    try {
      const value: unknown = JSON.parse(await fs.readFile(path.join(root, name), "utf8"));
      return readCatalog(value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      return undefined;
    }
  };
  let catalog = await read("library.json");
  const journal = await read("transaction.json");
  // 日志保留的是提交前清单。未完成提交一律回滚；没有日志时主清单是已确认版本。
  if (journal) {
    catalog = journal;
    await writeAtomicFile(primary, JSON.stringify(journal), nanoid());
  }
  if (!catalog) {
    catalog = await read("library.json.bak");
    if (catalog) {
      await fs.copyFile(primary, path.join(root, `library-damaged-${Date.now()}.json`)).catch(() => undefined);
      await writeAtomicFile(primary, JSON.stringify(catalog), nanoid());
    } else {
      const files = await fs.readdir(root);
      const previous = readPreviousItems();
      if (files.includes("library.json") || files.includes("items") || previous.length)
        reject("AUDIO_LIBRARY_RECOVERY_REQUIRED", "音频库清单异常，请从备份恢复；现有文件已保留", 503);
      catalog = {
        version: 1,
        libraryId: nanoid(),
        revision: 0,
        groups: [],
        items: [],
        presets: [],
        pendingDeletes: []
      };
      await writeAtomicFile(primary, JSON.stringify(catalog), nanoid());
    }
  }
  return catalog;
}

export async function finalizeAudioLibraryRecovery(root: string, catalog: AudioLibraryCatalog) {
  const primary = path.join(root, "library.json");
  // 将兼容读取后的清单落盘，SQLite 镜像、后续导出均不再携带退役字段。
  const serialized = JSON.stringify(catalog);
  if ((await fs.readFile(primary, "utf8")) !== serialized) await writeAtomicFile(primary, serialized, nanoid());
  await fs.rm(path.join(root, "transaction.json"), { force: true });
  await fs.mkdir(path.join(root, "items"), { recursive: true });
  // 启动期间没有活动导入，清理上次意外退出留下的临时副本；永久资产目录不在此范围。
  await fs.rm(path.join(root, "staging"), { recursive: true, force: true });
  // 未被任何有效清单引用的文件保留到恢复区，绝不把永久资产当作缓存删除。
  const known = new Set([...catalog.items.map((x) => x.id), ...catalog.pendingDeletes.map((x) => x.id)]);
  for (const entry of await fs.readdir(path.join(root, "items"), { withFileTypes: true })) {
    if (!entry.isDirectory() || known.has(entry.name)) continue;
    await fs.mkdir(path.join(root, "recovery"), { recursive: true });
    await fs.rename(path.join(root, "items", entry.name), path.join(root, "recovery", `${entry.name}-${nanoid(6)}`));
  }
}
