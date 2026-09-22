/**
 * 中文模块说明：桌面数据迁移层，负责在用户数据目录内复制、校验、原子切换和回滚历史数据。
 * 安装目录只作为只读资源目录存在；本模块的所有写入目标均被限制在 dataRoot 内。
 */
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const MANIFEST_FILE = "migration-manifest.json";
const JOURNAL_DIRECTORY = "desktop-migrations";
const BACKUP_DIRECTORY = "migration-backups";
const LEGACY_MARKERS = [
  "toolbox.db",
  "lan-transfer",
  "xhs-archive",
  "image-ai",
  "edge-tts",
  "chatterbox",
  "video-text",
  "uploads",
  "outputs"
];

export type DesktopDataMigrationOptions = {
  /** Electron 的 userData 父目录，例如 %LOCALAPPDATA%\\EcommerceToolbox。 */
  dataRoot: string;
  /** 当前实际数据目录，必须位于 dataRoot 内。 */
  storageRoot: string;
  /** 当前配置目录，必须位于 dataRoot 内。 */
  configRoot: string;
};

type FileInventory = {
  files: Array<{ relativePath: string; bytes: number; sha256: string }>;
  fileCount: number;
  totalBytes: number;
};

type MigrationManifest = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  sourceLabel: string;
  previousDataExisted: boolean;
  previous: FileInventory;
  imported: FileInventory;
};

type JournalState = "staging-ready" | "previous-backed-up" | "committed" | "rollback-current-backed-up" | "rolled-back";

type MigrationJournal = {
  schemaVersion: 1;
  id: string;
  state: JournalState;
  storageRoot: string;
  stagingRoot: string;
  backupRoot: string;
  createdAt: string;
};

export type DesktopDataMigrationResult = {
  id: string;
  source: { files: number; bytes: number };
  previous: { files: number; bytes: number };
};

export type DesktopDataRollbackResult = {
  id: string;
  restored: { files: number; bytes: number };
};

/** 在启动前恢复未完成切换，优先恢复迁移前的数据，而不是猜测半成品是否可用。 */
export async function recoverDesktopDataMigrations(options: DesktopDataMigrationOptions) {
  const scope = resolveScope(options);
  const journalsDirectory = path.join(scope.configRoot, JOURNAL_DIRECTORY);
  const entries = await fs.readdir(journalsDirectory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{24}\.json$/.test(entry.name)) continue;
    const journalPath = safeChildPath(journalsDirectory, entry.name, "非法迁移日志路径");
    const journal = parseJournal(JSON.parse(await fs.readFile(journalPath, "utf8")), scope);
    if (journal.state === "staging-ready") {
      await fs.rm(journal.stagingRoot, { recursive: true, force: true });
      await writeJournal(journalPath, { ...journal, state: "rolled-back" });
      continue;
    }
    if (journal.state === "previous-backed-up") {
      // 旧目录已移走但新目录尚未完成提交：恢复旧目录，避免任何半迁移数据被启动进程读取。
      if (await pathExists(journal.storageRoot)) {
        throw new Error(`发现不一致的桌面迁移 ${journal.id}；请勿继续启动或手动删除数据`);
      }
      const previous = path.join(journal.backupRoot, "previous-data");
      if (await pathExists(previous)) await fs.rename(previous, journal.storageRoot);
      await fs.rm(journal.stagingRoot, { recursive: true, force: true });
      await writeJournal(journalPath, { ...journal, state: "rolled-back" });
      continue;
    }
    if (journal.state === "rollback-current-backed-up") {
      // 回滚切换尚未完成时，优先恢复用户回滚前正在使用的数据。
      if (await pathExists(journal.storageRoot)) {
        throw new Error(`发现不一致的桌面回滚 ${journal.id}；请勿继续启动或手动删除数据`);
      }
      const current = path.join(journal.backupRoot, "rollback-current-data");
      if (await pathExists(current)) await fs.rename(current, journal.storageRoot);
      await writeJournal(journalPath, { ...journal, state: "committed" });
    }
  }
}

export async function importDesktopData(
  options: DesktopDataMigrationOptions,
  sourceRoot: string
): Promise<DesktopDataMigrationResult> {
  const scope = resolveScope(options);
  await recoverDesktopDataMigrations(scope);
  const source = await validateLegacySource(scope, sourceRoot);
  const id = crypto.randomBytes(12).toString("hex");
  const stagingRoot = safeChildPath(scope.dataRoot, `.data-import-${id}`, "非法临时迁移目录");
  const backupRoot = safeChildPath(scope.dataRoot, `${BACKUP_DIRECTORY}/desktop/${id}`, "非法迁移备份目录");
  const journalPath = safeChildPath(path.join(scope.configRoot, JOURNAL_DIRECTORY), `${id}.json`, "非法迁移日志路径");
  const previousDataExisted = await pathExists(scope.storageRoot);
  let journal: MigrationJournal | undefined;

  try {
    await fs.mkdir(stagingRoot, { recursive: false });
    const imported = await copyAndInventory(source, stagingRoot);
    await verifyInventory(stagingRoot, imported);
    const previous = previousDataExisted ? await scanInventory(scope.storageRoot) : emptyInventory();
    await fs.mkdir(path.dirname(backupRoot), { recursive: true });
    await fs.mkdir(backupRoot, { recursive: false });
    await writeManifest(backupRoot, {
      schemaVersion: 1,
      id,
      createdAt: new Date().toISOString(),
      sourceLabel: path.basename(source),
      previousDataExisted,
      previous,
      imported
    });
    journal = {
      schemaVersion: 1,
      id,
      state: "staging-ready",
      storageRoot: scope.storageRoot,
      stagingRoot,
      backupRoot,
      createdAt: new Date().toISOString()
    };
    await writeJournal(journalPath, journal);

    if (previousDataExisted) {
      await fs.rename(scope.storageRoot, path.join(backupRoot, "previous-data"));
    }
    journal = { ...journal, state: "previous-backed-up" };
    await writeJournal(journalPath, journal);
    await fs.rename(stagingRoot, scope.storageRoot);
    await verifyInventory(scope.storageRoot, imported);
    await writeJournal(journalPath, { ...journal, state: "committed" });
    return {
      id,
      source: { files: imported.fileCount, bytes: imported.totalBytes },
      previous: { files: previous.fileCount, bytes: previous.totalBytes }
    };
  } catch (error) {
    await restoreAfterFailedImport(journal, journalPath).catch(() => undefined);
    await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function rollbackDesktopData(
  options: DesktopDataMigrationOptions,
  migrationId: string
): Promise<DesktopDataRollbackResult> {
  const scope = resolveScope(options);
  await recoverDesktopDataMigrations(scope);
  if (!/^[a-f0-9]{24}$/.test(migrationId)) throw new Error("无效的迁移编号");
  const backupRoot = safeChildPath(scope.dataRoot, `${BACKUP_DIRECTORY}/desktop/${migrationId}`, "非法迁移备份目录");
  const manifest = await readManifest(backupRoot, migrationId);
  const journalPath = safeChildPath(
    path.join(scope.configRoot, JOURNAL_DIRECTORY),
    `${migrationId}.json`,
    "非法迁移日志路径"
  );
  const journal = parseJournal(JSON.parse(await fs.readFile(journalPath, "utf8")), scope);
  if (journal.state !== "committed") throw new Error("此迁移当前不能回滚");
  const previousRoot = path.join(backupRoot, "previous-data");
  if (manifest.previousDataExisted) await verifyInventory(previousRoot, manifest.previous);
  else if (await pathExists(previousRoot)) throw new Error("迁移备份状态无效");

  const currentRoot = path.join(backupRoot, "rollback-current-data");
  if (await pathExists(currentRoot)) throw new Error("该迁移已存在回滚保护副本，不能重复回滚");
  if (await pathExists(scope.storageRoot)) await fs.rename(scope.storageRoot, currentRoot);
  const rollbackJournal = { ...journal, state: "rollback-current-backed-up" as const };
  await writeJournal(journalPath, rollbackJournal);
  try {
    if (manifest.previousDataExisted) await fs.rename(previousRoot, scope.storageRoot);
    else await fs.mkdir(scope.storageRoot, { recursive: true });
    if (manifest.previousDataExisted) await verifyInventory(scope.storageRoot, manifest.previous);
    await writeJournal(journalPath, { ...rollbackJournal, state: "rolled-back" });
    return { id: migrationId, restored: { files: manifest.previous.fileCount, bytes: manifest.previous.totalBytes } };
  } catch (error) {
    const failedRollback = path.join(backupRoot, "failed-rollback-data");
    if ((await pathExists(scope.storageRoot)) && !(await pathExists(failedRollback))) {
      await fs.rename(scope.storageRoot, failedRollback);
    }
    if (!(await pathExists(scope.storageRoot)) && (await pathExists(currentRoot)))
      await fs.rename(currentRoot, scope.storageRoot);
    await writeJournal(journalPath, { ...rollbackJournal, state: "committed" }).catch(() => undefined);
    throw error;
  }
}

function resolveScope(options: DesktopDataMigrationOptions): Required<DesktopDataMigrationOptions> {
  const dataRoot = path.resolve(options.dataRoot);
  const storageRoot = path.resolve(options.storageRoot);
  const configRoot = path.resolve(options.configRoot);
  if (!isChildPath(dataRoot, storageRoot) || !isChildPath(dataRoot, configRoot)) {
    throw new Error("桌面数据和设置目录必须位于用户数据目录内");
  }
  return { dataRoot, storageRoot, configRoot };
}

async function validateLegacySource(scope: Required<DesktopDataMigrationOptions>, sourceRoot: string) {
  const source = path.resolve(sourceRoot);
  if (source === scope.dataRoot || isChildPath(scope.dataRoot, source) || isChildPath(source, scope.dataRoot)) {
    throw new Error("历史数据目录不能与当前用户数据目录重叠");
  }
  const stat = await fs.lstat(source).catch(() => undefined);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) throw new Error("请选择有效的历史数据目录");
  const names = await fs.readdir(source);
  if (!names.some((name) => LEGACY_MARKERS.includes(name))) {
    throw new Error("所选目录不包含可识别的电商工具箱历史数据");
  }
  return source;
}

async function copyAndInventory(sourceRoot: string, destinationRoot: string): Promise<FileInventory> {
  const files: FileInventory["files"] = [];
  await copyDirectory(sourceRoot, destinationRoot, "", files);
  return summarizeInventory(files);
}

async function copyDirectory(
  sourceRoot: string,
  destinationRoot: string,
  relativeRoot: string,
  files: FileInventory["files"]
) {
  const sourceDirectory = relativeRoot ? safeChildPath(sourceRoot, relativeRoot, "非法历史数据路径") : sourceRoot;
  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = relativeRoot ? path.posix.join(relativeRoot, entry.name) : entry.name;
    const source = safeChildPath(sourceRoot, relativePath, "非法历史数据路径");
    const destination = safeChildPath(destinationRoot, relativePath, "非法迁移目标路径");
    const stat = await fs.lstat(source);
    if (stat.isSymbolicLink()) throw new Error(`历史数据包含不允许的链接：${relativePath}`);
    if (stat.isDirectory()) {
      await fs.mkdir(destination, { recursive: false });
      await copyDirectory(sourceRoot, destinationRoot, relativePath, files);
      continue;
    }
    if (!stat.isFile()) throw new Error(`历史数据包含不支持的文件类型：${relativePath}`);
    await fs.copyFile(source, destination);
    const copied = await fs.lstat(destination);
    if (!copied.isFile() || copied.size !== stat.size) throw new Error(`复制校验失败：${relativePath}`);
    const sourceHash = await sha256File(source);
    const destinationHash = await sha256File(destination);
    if (sourceHash !== destinationHash) throw new Error(`复制摘要校验失败：${relativePath}`);
    files.push({ relativePath, bytes: stat.size, sha256: sourceHash });
  }
}

async function scanInventory(root: string): Promise<FileInventory> {
  if (!(await pathExists(root))) return emptyInventory();
  const files: FileInventory["files"] = [];
  await scanDirectory(root, "", files);
  return summarizeInventory(files);
}

async function scanDirectory(root: string, relativeRoot: string, files: FileInventory["files"]) {
  const directory = relativeRoot ? safeChildPath(root, relativeRoot, "非法数据路径") : root;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = relativeRoot ? path.posix.join(relativeRoot, entry.name) : entry.name;
    const source = safeChildPath(root, relativePath, "非法数据路径");
    const stat = await fs.lstat(source);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new Error(`数据目录包含不支持的文件类型：${relativePath}`);
    }
    if (stat.isDirectory()) await scanDirectory(root, relativePath, files);
    else files.push({ relativePath, bytes: stat.size, sha256: await sha256File(source) });
  }
}

async function verifyInventory(root: string, expected: FileInventory) {
  const actual = await scanInventory(root);
  if (actual.fileCount !== expected.fileCount || actual.totalBytes !== expected.totalBytes) {
    throw new Error("迁移文件清单校验失败");
  }
  for (let index = 0; index < expected.files.length; index += 1) {
    const expectedFile = expected.files[index];
    const actualFile = actual.files[index];
    if (
      !actualFile ||
      actualFile.relativePath !== expectedFile.relativePath ||
      actualFile.bytes !== expectedFile.bytes ||
      actualFile.sha256 !== expectedFile.sha256
    ) {
      throw new Error(`迁移文件摘要校验失败：${expectedFile.relativePath}`);
    }
  }
}

function summarizeInventory(files: FileInventory["files"]): FileInventory {
  return {
    files: [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0)
  };
}

function emptyInventory(): FileInventory {
  return { files: [], fileCount: 0, totalBytes: 0 };
}

async function writeManifest(backupRoot: string, manifest: MigrationManifest) {
  const manifestPath = safeChildPath(backupRoot, MANIFEST_FILE, "非法迁移清单路径");
  await writeJsonAtomically(manifestPath, manifest);
}

async function readManifest(backupRoot: string, id: string): Promise<MigrationManifest> {
  const manifestPath = safeChildPath(backupRoot, MANIFEST_FILE, "非法迁移清单路径");
  return parseManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")), id);
}

async function writeJournal(journalPath: string, journal: MigrationJournal) {
  await writeJsonAtomically(journalPath, journal);
}

async function writeJsonAtomically(target: string, value: unknown) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    const handle = await fs.open(temporary, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function parseManifest(value: unknown, id: string): MigrationManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.id !== id || typeof value.createdAt !== "string") {
    throw new Error("迁移备份清单无效");
  }
  if (typeof value.sourceLabel !== "string" || typeof value.previousDataExisted !== "boolean") {
    throw new Error("迁移备份清单无效");
  }
  return {
    schemaVersion: 1,
    id,
    createdAt: value.createdAt,
    sourceLabel: value.sourceLabel,
    previousDataExisted: value.previousDataExisted,
    previous: parseInventory(value.previous),
    imported: parseInventory(value.imported)
  };
}

function parseJournal(value: unknown, scope: Required<DesktopDataMigrationOptions>): MigrationJournal {
  if (!isRecord(value) || value.schemaVersion !== 1 || !/^[a-f0-9]{24}$/.test(stringValue(value.id))) {
    throw new Error("迁移日志无效");
  }
  const state = value.state;
  if (
    state !== "staging-ready" &&
    state !== "previous-backed-up" &&
    state !== "committed" &&
    state !== "rollback-current-backed-up" &&
    state !== "rolled-back"
  ) {
    throw new Error("迁移日志无效");
  }
  const id = stringValue(value.id);
  const expectedStaging = safeChildPath(scope.dataRoot, `.data-import-${id}`, "非法迁移临时目录");
  const expectedBackup = safeChildPath(scope.dataRoot, `${BACKUP_DIRECTORY}/desktop/${id}`, "非法迁移备份目录");
  if (
    path.resolve(stringValue(value.storageRoot)) !== scope.storageRoot ||
    path.resolve(stringValue(value.stagingRoot)) !== expectedStaging ||
    path.resolve(stringValue(value.backupRoot)) !== expectedBackup ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("迁移日志范围无效");
  }
  return {
    schemaVersion: 1,
    id,
    state,
    storageRoot: scope.storageRoot,
    stagingRoot: expectedStaging,
    backupRoot: expectedBackup,
    createdAt: value.createdAt
  };
}

function parseInventory(value: unknown): FileInventory {
  if (
    !isRecord(value) ||
    !Array.isArray(value.files) ||
    !isNonNegativeInteger(value.fileCount) ||
    !isNonNegativeInteger(value.totalBytes)
  ) {
    throw new Error("迁移备份清单无效");
  }
  const files = value.files.map((entry) => {
    if (
      !isRecord(entry) ||
      !isSafeRelativePath(entry.relativePath) ||
      !isNonNegativeInteger(entry.bytes) ||
      !/^[a-f0-9]{64}$/.test(stringValue(entry.sha256))
    ) {
      throw new Error("迁移备份清单无效");
    }
    return { relativePath: entry.relativePath, bytes: entry.bytes, sha256: stringValue(entry.sha256) };
  });
  const summary = summarizeInventory(files);
  if (summary.fileCount !== value.fileCount || summary.totalBytes !== value.totalBytes) {
    throw new Error("迁移备份清单无效");
  }
  return summary;
}

async function restoreAfterFailedImport(journal: MigrationJournal | undefined, journalPath: string) {
  if (!journal || journal.state !== "previous-backed-up") return;
  const previous = path.join(journal.backupRoot, "previous-data");
  const failedImport = path.join(journal.backupRoot, "failed-import-data");
  // 切换已经完成但复核失败时，失败副本也保留在用户目录中；绝不删除它或覆盖已验证的旧数据。
  if ((await pathExists(journal.storageRoot)) && !(await pathExists(failedImport))) {
    await fs.rename(journal.storageRoot, failedImport);
  }
  if (!(await pathExists(journal.storageRoot)) && (await pathExists(previous)))
    await fs.rename(previous, journal.storageRoot);
  await writeJournal(journalPath, { ...journal, state: "rolled-back" });
}

function safeChildPath(root: string, relativePath: string, message: string) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (!isChildPath(resolvedRoot, resolved)) throw new Error(message);
  return resolved;
}

function isChildPath(root: string, candidate: string) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relative) && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function isSafeRelativePath(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && !path.isAbsolute(value) && !value.split(/[\\/]/).includes("..")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

async function pathExists(target: string) {
  return Boolean(await fs.lstat(target).catch(() => undefined));
}

async function sha256File(filePath: string): Promise<string> {
  const digest = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => {
      digest.update(chunk);
    });
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return digest.digest("hex");
}
