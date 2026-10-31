import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import type { BackupMode, BackupModuleId, BackupPreview, BackupSelection } from "@toolbox/shared/system";
import { cleanBackupPreferences } from "@toolbox/shared/system";
import { mapped } from "./references";
import { validateModuleData } from "./validation";
import type { AppConfig } from "../../config";
import { ToolboxDatabase } from "../../database/toolbox-database";
import { inventory, assertFileOwnership } from "./registry";
import { copyHashed, enoughSpace, ownedPath, writeBundleMetadata, readBundle, packBundle } from "./package-io";
import { planRestore, receiptKey, fingerprint, makeReceipt, type ImportReceipt } from "./merge";
import { applyRestore, recoverRestores } from "./restore";
import type { BackupBundle, BackupProgress, ModuleData } from "./types";

export type BackupContext = {
  config: AppConfig;
  controlRoot: string;
  appVersion: string;
  signal: AbortSignal;
  progress: BackupProgress;
};
export async function writeDurable(filename: string, value: unknown) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "wx");
  try {
    await handle.writeFile(JSON.stringify(value));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, filename);
}
export async function readJson<T>(filename: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filename, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
export async function currentModules(
  context: BackupContext,
  ids: BackupModuleId[],
  withHashes = true
): Promise<ModuleData[]> {
  const db = new ToolboxDatabase(context.config.databasePath, { maintenance: true, readonly: true });
  try {
    const modules: ModuleData[] = [];
    for (const id of ids) modules.push(await inventory(db, context.config, id));
    if (withHashes) {
      const files = modules.flatMap((module) => module.files);
      let count = 0,
        bytes = 0;
      const total = files.reduce((n, f) => n + f.bytes, 0);
      for (const file of files) {
        context.signal.throwIfAborted();
        const actual = await copyHashed(
          await ownedPath(context.config.storageRoot, file.path),
          undefined,
          context.signal,
          (n) => {
            bytes += n;
            context.progress("检查现有数据", count, files.length, bytes, total);
          }
        );
        if (file.sha256 && file.sha256 !== actual.sha256) throw new Error(`现有媒体摘要异常：${file.path}`);
        file.sha256 = actual.sha256;
        count++;
      }
    }
    return modules;
  } finally {
    db.close();
  }
}
export async function snapshot(
  context: BackupContext,
  selection: BackupSelection,
  directory: string
): Promise<BackupBundle> {
  const modules = await currentModules(context, selection.modules, false);
  const total = modules.flatMap((m) => m.files).reduce((n, f) => n + f.bytes, 0);
  await fs.mkdir(path.join(directory, "objects"), { recursive: true });
  await enoughSpace(directory, total);
  let bytes = 0,
    count = 0;
  const files = modules.flatMap((m) => m.files);
  for (const file of files) {
    context.signal.throwIfAborted();
    const temporary = path.join(directory, "objects", crypto.randomUUID());
    const actual = await copyHashed(
      await ownedPath(context.config.storageRoot, file.path),
      temporary,
      context.signal,
      (n) => {
        bytes += n;
        context.progress("复制一致快照", count, files.length, bytes, total);
      }
    );
    if (file.sha256 && file.sha256 !== actual.sha256) throw new Error(`媒体校验失败：${file.path}`);
    file.sha256 = actual.sha256;
    const target = path.join(directory, "objects", actual.sha256);
    if (await fs.stat(target).catch(() => undefined)) await fs.rm(temporary);
    else await fs.rename(temporary, target);
    count++;
    context.progress("复制一致快照", count, files.length, bytes, total);
  }
  for (const module of modules)
    if (selection.preferences) module.preferences = filterPreferences(module.id, selection.preferences);
  for (const module of modules) validateModuleData(module);
  const manifest = await writeBundleMetadata(directory, modules, context.appVersion);
  return { manifest, modules, directory };
}
const preferenceKeys: Partial<Record<BackupModuleId, readonly string[]>> = {
  "content-archive": ["archive.view"],
  "audio-library": ["audio.lastGroup", "audio.recentGroups", "audio.player"]
};
function filterPreferences(id: BackupModuleId, input: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(cleanBackupPreferences(input)).filter(([key]) => preferenceKeys[id]?.includes(key))
  );
}
type SavedPlan = {
  id: string;
  expiresAt: string;
  file: string;
  selection: BackupModuleId[];
  mode: BackupMode;
  fingerprint: string;
  packageHash: string;
  preview: BackupPreview;
};
export async function inspectPackage(context: BackupContext, file: string, directory: string) {
  const bundle = await readBundle(file, directory, context.signal, context.progress);
  for (const module of bundle.modules) for (const entry of module.files) assertFileOwnership(module, entry);
  for (const module of bundle.modules) validateModuleData(module);
  return bundle;
}
export async function previewImport(
  context: BackupContext,
  file: string,
  ids: BackupModuleId[],
  mode: BackupMode,
  id: string
): Promise<BackupPreview> {
  const directory = path.join(context.controlRoot, "work", id);
  const bundle = await inspectPackage(context, file, path.join(directory, "package"));
  const packageBytes = [
    ...new Map(
      bundle.modules.flatMap((module) => module.files.map((file) => [file.sha256, file.bytes] as const))
    ).values()
  ].reduce((sum, size) => sum + size, 0);
  bundle.modules = bundle.modules.filter((m) => ids.includes(m.id));
  if (bundle.modules.length !== ids.length) throw new Error("备份不包含所选模块");
  const current = await currentModules(context, ids);
  const db = new ToolboxDatabase(context.config.databasePath, { maintenance: true, readonly: true });
  try {
    const receipt = db.get("data-backup-receipt", receiptKey(bundle))?.payload as ImportReceipt | undefined;
    const draft = planRestore(bundle, current, mode, context.config, db, receipt);
    const requiredBytes =
      packageBytes +
      [
        ...new Map(current.flatMap((module) => module.files.map((file) => [file.sha256, file.bytes] as const))).values()
      ].reduce((sum, size) => sum + size, 0) +
      draft.files.reduce(
        (sum, file) =>
          sum +
          (file.content !== undefined
            ? Buffer.byteLength(file.content)
            : (draft.modules.flatMap((module) => module.files).find((entry) => entry.path === file.path)?.bytes ?? 0)),
        0
      ) +
      Buffer.byteLength(JSON.stringify(draft.modules.map((module) => module.records))) * 5 +
      32 * 1024 ** 2;
    const preview: BackupPreview = {
      planId: id,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      mode,
      createdAt: bundle.manifest.createdAt,
      appVersion: bundle.manifest.appVersion,
      requiredBytes,
      modules: bundle.manifest.modules
        .filter((m) => ids.includes(m.id))
        .map((meta) => ({
          id: meta.id,
          records: meta.records,
          files: meta.files,
          bytes: meta.bytes,
          expired: meta.expired,
          existing: current.find((m) => m.id === meta.id)!.records.length,
          ...draft.counts.get(meta.id)!
        })),
      warnings: [
        "恢复期间将暂时停止所有模块的后台服务；不会自动继续生成或平台获取任务。",
        "保留原到期时间，已经到期的数据可能按现有规则在启动后清理。",
        ...(mode === "replace" ? ["将替换所选模块的全部现有业务数据；空模块将清空对应数据。未选模块保持不变。"] : [])
      ]
    };
    const saved: SavedPlan = {
      id,
      expiresAt: preview.expiresAt,
      file,
      selection: ids,
      mode,
      fingerprint: draft.fingerprint,
      packageHash: await packageFingerprint(file, context.signal),
      preview
    };
    await writeDurable(path.join(directory, "plan.json"), saved);
    return preview;
  } finally {
    db.close();
    await fs.rm(path.join(directory, "package"), { recursive: true, force: true });
  }
}
export async function restoreImport(
  context: BackupContext,
  planId: string,
  operationId: string,
  clientPreferences: Record<string, string> = {}
) {
  const saved = await readJson<SavedPlan>(path.join(context.controlRoot, "work", planId, "plan.json"));
  if (!saved || Date.parse(saved.expiresAt) < Date.now()) throw new Error("导入预检已失效，请重新预检");
  if ((await packageFingerprint(saved.file, context.signal)) !== saved.packageHash)
    throw new Error("备份文件在预检后变化，请重新选择");
  const directory = path.join(context.controlRoot, "work", operationId);
  const bundle = await inspectPackage(context, saved.file, path.join(directory, "package"));
  bundle.modules = bundle.modules.filter((m) => saved.selection.includes(m.id));
  const current = await currentModules(context, saved.selection);
  if (fingerprint(current) !== saved.fingerprint) throw new Error("现有数据在预检后变化，请重新预检后再导入");
  const db = new ToolboxDatabase(context.config.databasePath, { maintenance: true });
  try {
    const draft = planRestore(
      bundle,
      current,
      saved.mode,
      context.config,
      db,
      db.get("data-backup-receipt", receiptKey(bundle))?.payload as ImportReceipt | undefined
    );
    if (
      saved.preview.modules.some((meta) => {
        const next = draft.counts.get(meta.id);
        return !next || next.added !== meta.added || next.skipped !== meta.skipped || next.conflicts !== meta.conflicts;
      })
    )
      throw new Error("共享记录或冲突范围在预检后变化，请重新预检");
    const restorePoint = path.join(context.controlRoot, "restore-points", operationId);
    await snapshot(
      context,
      { modules: saved.selection, preferences: cleanBackupPreferences(clientPreferences) },
      restorePoint
    );
    context.signal.throwIfAborted();
    await applyRestore(context, db, bundle, current, draft, operationId, makeReceipt(bundle, draft));
    const preferences = Object.assign(
      {},
      ...bundle.modules.map((m) => filterPreferences(m.id, m.preferences ?? {}))
    ) as Record<string, string>;
    if (preferences["audio.lastGroup"])
      preferences["audio.lastGroup"] = mapped(
        draft.mappings,
        "audio-library",
        "audio-library-group",
        preferences["audio.lastGroup"]
      );
    if (preferences["audio.recentGroups"])
      preferences["audio.recentGroups"] = JSON.stringify(
        (JSON.parse(preferences["audio.recentGroups"]) as string[]).map((id) =>
          mapped(draft.mappings, "audio-library", "audio-library-group", id)
        )
      );
    if (preferences["audio.player"]) {
      const player = JSON.parse(preferences["audio.player"]) as { queue: Array<{ itemId: string }> };
      for (const entry of player.queue)
        entry.itemId = mapped(draft.mappings, "audio-library", "audio-library-item", entry.itemId);
      preferences["audio.player"] = JSON.stringify(player);
    }
    return { restorePointId: operationId, preferences };
  } finally {
    db.close();
    await fs.rm(path.join(directory, "package"), { recursive: true, force: true });
  }
}
async function packageFingerprint(file: string, signal: AbortSignal) {
  return (await copyHashed(file, undefined, signal)).sha256;
}
export { packBundle, recoverRestores };
