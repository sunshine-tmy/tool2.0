/** Crash-safe file switching plus one domain DB transaction. Never restore the whole database. */
import fs from "node:fs/promises";
import path from "node:path";
import type { BackupContext } from "./service";
import { readJson, writeDurable } from "./service";
import { hashText, ownedPath, copyHashed, enoughSpace, safeRelative } from "./package-io";
import { ownership, object, portablePaths, speechDirectory } from "./registry";
import { receiptKey, type ImportReceipt } from "./merge";
import { ToolboxDatabase } from "../../database/toolbox-database";
import type { BackupBundle, ModuleData, RestoreDraft } from "./types";

type Journal = {
  id: string;
  state: "prepared" | "switching" | "committed";
  modules: string[];
  changes: Array<{ path: string; existed: boolean; hash?: string }>;
};
function assertOperationId(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("恢复操作编号无效");
  return id;
}
function stageRoot(context: BackupContext, id: string) {
  return path.join(context.config.storageRoot, `.module-restore-${assertOperationId(id)}`);
}
function journalPath(context: BackupContext, id: string) {
  return path.join(context.controlRoot, "journals", `${assertOperationId(id)}.json`);
}
function sidecars(module: ModuleData) {
  const paths: string[] = [];
  for (const row of module.records) {
    if (row.kind === "xhs-archive") paths.push(`xhs-archive/items/${row.id}/manifest.json`);
    if (["chatterbox-voice", "chatterbox-batch", "chatterbox-task", "edge-tts-task"].includes(row.kind))
      paths.push(`${speechDirectory(row.kind, row.id, row.payload)}/meta.json`);
  }
  return paths;
}
function generatedIndexes(modules: ModuleData[]) {
  return modules.flatMap((module) => {
    if (module.id === "content-archive")
      return [
        {
          path: "xhs-archive/index.json",
          content: JSON.stringify({
            version: 2,
            items: module.records.filter((r) => r.kind === "xhs-archive").map((r) => r.payload)
          })
        }
      ];
    if (module.id === "lan-transfer")
      return [
        {
          path: "lan-transfer/index.json",
          content: JSON.stringify(module.records.filter((r) => r.kind === "lan-file").map((r) => r.payload))
        },
        {
          path: "lan-transfer/notes/index.json",
          content: JSON.stringify(module.records.filter((r) => r.kind === "lan-note").map((r) => r.payload))
        }
      ];
    return [];
  });
}
export async function applyRestore(
  context: BackupContext,
  db: ToolboxDatabase,
  bundle: BackupBundle,
  current: ModuleData[],
  draft: RestoreDraft,
  id: string,
  receipt: ImportReceipt
) {
  const root = stageRoot(context, id);
  await fs.mkdir(root, { recursive: true });
  await ownedPath(context.config.storageRoot, path.basename(root));
  const needed = draft.files.reduce(
    (total, file) =>
      total +
      (file.content !== undefined
        ? Buffer.byteLength(file.content)
        : (draft.modules.flatMap((module) => module.files).find((entry) => entry.path === file.path)?.bytes ?? 0)),
    0
  );
  await enoughSpace(root, needed);
  const writes = [...draft.files, ...generatedIndexes(draft.modules)];
  const newPaths = new Set(writes.map((f) => f.path));
  const remove = new Set([...draft.removeFiles, ...current.flatMap(sidecars)].filter((p) => !newPaths.has(p)));
  // Sidecars belonging to preserved merged records must stay in place.
  for (const module of draft.modules) for (const file of sidecars(module)) remove.delete(file);
  const entries = new Map(writes.map((f) => [f.path.toLowerCase(), f]));
  if (entries.size !== writes.length) throw new Error("恢复后的文件目标重复");
  const journal: Journal = { id, state: "prepared", modules: draft.modules.map((m) => m.id), changes: [] };
  const changes = [...writes, ...[...remove].map((relative) => ({ path: relative }))];
  const knownCurrent = new Set([
    ...current.flatMap((module) => module.files.map((file) => file.path)),
    ...current.flatMap(sidecars),
    "audio-library/library.json",
    "audio-library/library.json.bak",
    "xhs-archive/index.json",
    "lan-transfer/index.json",
    "lan-transfer/notes/index.json"
  ]);
  let prepared = 0;
  try {
    for (const change of changes) {
      context.signal.throwIfAborted();
      const target = await ownedPath(context.config.storageRoot, change.path, true);
      const stat = await fs.stat(target).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      });
      if (stat && !stat.isFile()) throw new Error("恢复目标不是普通文件");
      if (stat && !knownCurrent.has(change.path))
        throw new Error("恢复目标存在未登记的文件，已保留原文件，请检查后重试");
      let hash: string | undefined;
      const number = journal.changes.length;
      if ("source" in change && typeof change.source === "string")
        hash = (await copyHashed(change.source, path.join(root, `new-${number}`), context.signal)).sha256;
      if ("content" in change && typeof change.content === "string") {
        const filename = path.join(root, `new-${number}`);
        const handle = await fs.open(filename, "wx");
        try {
          await handle.writeFile(change.content);
          await handle.sync();
        } finally {
          await handle.close();
        }
        hash = hashText(change.content);
      }
      journal.changes.push({ path: change.path, existed: Boolean(stat), hash });
      context.progress("准备恢复文件", ++prepared, changes.length, 0, 0);
    }
    await writeDurable(journalPath(context, id), journal);
    context.signal.throwIfAborted();
    // From here cancellation is deferred until the safe transaction boundary.
    context.progress("正在安全提交", 0, journal.changes.length, 0, 0);
    journal.state = "switching";
    await writeDurable(journalPath(context, id), journal);
    for (let n = 0; n < journal.changes.length; n++) {
      const change = journal.changes[n],
        target = await ownedPath(context.config.storageRoot, change.path, true);
      await fs.mkdir(path.dirname(target), { recursive: true });
      if (change.existed) await fs.rename(target, path.join(root, `old-${n}`));
      if (change.hash) await fs.rename(path.join(root, `new-${n}`), target);
      context.progress("正在安全提交", n + 1, journal.changes.length, 0, 0);
    }
    db.transaction(() => {
      for (const module of current) {
        // Children first, parents last, preserving SQLite FK checks throughout the transaction.
        for (const kind of [...ownership[module.id].kinds].reverse())
          for (const row of module.records.filter((r) => r.kind === kind)) db.remove(row.kind, row.id);
        for (const row of module.records.filter((r) => r.kind === "task")) db.remove("task", row.id);
        const currentPaths = new Set([...module.files.map((f) => f.path), ...sidecars(module)]);
        for (const file of db.listFiles()) if (currentPaths.has(file.relativePath)) db.removeFile(file.id);
      }
      for (const module of draft.modules) {
        for (const kind of [...ownership[module.id].kinds, "task"])
          for (const row of module.records.filter((r) => r.kind === kind))
            db.upsert({ ...row, payload: portablePaths(row.payload, context.config, true) });
        for (const kind of ownership[module.id].kinds) db.markDomainInitialized(kind);
        // Replacing a module invalidates only its previous receipt entries, not the other modules' receipts.
        for (const old of draft.mode === "replace" ? db.list("data-backup-receipt") : []) {
          const data = object(old.payload) as ImportReceipt;
          for (const key of Object.keys(data.mappings ?? {}))
            if (key.startsWith(`${module.id}/`)) {
              delete data.mappings[key];
              delete data.targets[key];
            }
          db.upsert({ ...old, payload: data });
        }
      }
      for (const file of draft.metadata) db.upsertFile(file);
      for (const change of writes)
        if ("content" in change && change.path.endsWith("/manifest.json")) {
          const archiveId = change.path.split("/")[2];
          db.upsertFile({
            id: hashText(`xhs-archive\0${archiveId}\0${change.path}`),
            entityKind: "xhs-archive",
            entityId: archiveId,
            relativePath: change.path,
            byteSize: Buffer.byteLength(change.content!),
            sha256: hashText(change.content!),
            mediaType: "application/json",
            owner: "local",
            createdAt: new Date().toISOString()
          });
        }
      const now = new Date().toISOString();
      const previous = db.get("data-backup-receipt", receiptKey(bundle))?.payload as ImportReceipt | undefined;
      db.upsert({
        id: receiptKey(bundle),
        kind: "data-backup-receipt",
        payload: {
          mappings: { ...previous?.mappings, ...receipt.mappings },
          targets: { ...previous?.targets, ...receipt.targets }
        },
        createdAt: now,
        updatedAt: now
      });
      db.upsert({
        id,
        kind: "data-backup-commit",
        payload: { modules: journal.modules },
        createdAt: now,
        updatedAt: now
      });
      const check = db.verifyQuick();
      if (check.integrity !== "ok" || check.foreignKeys.length) throw new Error("恢复后数据库关联校验未通过");
    });
    journal.state = "committed";
    await writeDurable(journalPath(context, id), journal);
  } catch (error) {
    if (await readJson(journalPath(context, id))) await recoverOne(context, id);
    else await fs.rm(root, { recursive: true, force: true });
    throw error;
  }
  await recoverOne(context, id);
}
async function recoverOne(context: BackupContext, id: string) {
  const journal = await readJson<Journal>(journalPath(context, id));
  if (!journal) return;
  if (journal.id !== id || !Array.isArray(journal.changes)) throw new Error("恢复日志无效，请保留现场");
  const root = stageRoot(context, id);
  await ownedPath(context.config.storageRoot, path.basename(root));
  const db = new ToolboxDatabase(context.config.databasePath, { maintenance: true });
  try {
    const committed = Boolean(db.get("data-backup-commit", id));
    for (let n = journal.changes.length - 1; n >= 0; n--) {
      const change = journal.changes[n];
      safeRelative(change.path);
      const target = await ownedPath(context.config.storageRoot, change.path, true);
      if (committed) {
        if (change.hash && (await copyHashed(target, undefined)).sha256 !== change.hash)
          throw new Error("已提交恢复的文件校验失败，已保留恢复点和日志");
        continue;
      }
      const old = path.join(root, `old-${n}`);
      const oldExists = await fs.stat(old).catch(() => undefined);
      if (oldExists) {
        await fs.rm(target, { force: true });
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.rename(old, target);
      } else if (!change.existed && change.hash) {
        const installed = await fs.stat(target).catch(() => undefined);
        if (installed) {
          if ((await copyHashed(target, undefined)).sha256 !== change.hash)
            throw new Error("恢复目标出现未知变更，请保留日志检查");
          await fs.rm(target);
        }
      }
    }
    // Removing the durable journal precedes deleting the commit marker; an orphan marker is harmless.
    await fs.rm(journalPath(context, id));
    await fs.rm(root, { recursive: true, force: true });
    db.remove("data-backup-commit", id);
  } finally {
    db.close();
  }
}
export async function recoverRestores(context: BackupContext) {
  const directory = path.join(context.controlRoot, "journals");
  for (const filename of await fs.readdir(directory).catch(() => []))
    if (/^[a-f0-9-]{36}\.json$/.test(filename)) await recoverOne(context, filename.slice(0, -5));
}
