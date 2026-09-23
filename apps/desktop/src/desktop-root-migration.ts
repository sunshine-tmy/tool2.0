/** 中文模块说明：首次启动迁移层，将旧桌面数据根复制到安装目录内并保留源目录。 */
import crypto from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const MIGRATED_DIRECTORIES = [
  "config",
  "data",
  "components",
  "models",
  "profile",
  "logs",
  "migration-backups"
] as const;
const MIGRATION_JOURNAL = ".desktop-root-migration.json";
const MIGRATION_STATE = ".desktop-data-location.json";
const SCHEMA_VERSION = 1;

export type DesktopRootMigrationOptions = {
  dataRoot: string;
  legacyDataRoot: string;
};

export type StartupDataMigrationState = {
  required: boolean;
  sourceDirectory?: string;
  destinationDirectory: string;
  sourceBytes: number;
  sourceFiles: number;
  freeBytes?: number;
  sufficientSpace?: boolean;
};

export type DesktopRootMigrationResult = {
  id: string;
  files: number;
  bytes: number;
  sourceDirectory: string;
  destinationDirectory: string;
};

type InventoryEntry = { relativePath: string; bytes: number };
type DirectoryPlan = { name: string; existed: boolean; entries: InventoryEntry[] };
type MigrationJournal = {
  schemaVersion: number;
  id: string;
  state: "copying" | "staged" | "switching" | "committed";
  dataRoot: string;
  sourceRoot: string;
  stagingRoot: string;
  backupRoot: string;
  directories: DirectoryPlan[];
  files: number;
  bytes: number;
  completedAt?: string;
};

export async function prepareStartupDataMigration(
  options: DesktopRootMigrationOptions
): Promise<StartupDataMigrationState> {
  const scope = resolveScope(options);
  await fs.mkdir(scope.dataRoot, { recursive: true });
  await recoverDesktopRootMigration(scope);

  const statePath = path.join(scope.dataRoot, MIGRATION_STATE);
  const state = await readState(statePath);
  if (state) {
    return {
      required: false,
      destinationDirectory: scope.dataRoot,
      sourceBytes: state.bytes,
      sourceFiles: state.files
    };
  }

  const plans = await scanSourceDirectories(scope.legacyDataRoot);
  if (plans.length === 0) {
    await writeState(statePath, { schemaVersion: SCHEMA_VERSION, mode: "fresh", files: 0, bytes: 0 });
    return { required: false, destinationDirectory: scope.dataRoot, sourceBytes: 0, sourceFiles: 0 };
  }

  const sourceBytes = plans.reduce(
    (total, item) => total + item.entries.reduce((size, entry) => size + entry.bytes, 0),
    0
  );
  const sourceFiles = plans.reduce((total, item) => total + item.entries.length, 0);
  let freeBytes: number | undefined;
  try {
    const stats = await fs.statfs(scope.dataRoot);
    freeBytes = Number(stats.bavail) * Number(stats.bsize);
  } catch {
    // Some filesystems do not expose free-space information; actual copy errors remain actionable.
  }
  return {
    required: true,
    sourceDirectory: scope.legacyDataRoot,
    destinationDirectory: scope.dataRoot,
    sourceBytes,
    sourceFiles,
    ...(freeBytes === undefined ? {} : { freeBytes, sufficientSpace: freeBytes >= sourceBytes })
  };
}

export async function chooseFreshDesktopData(options: DesktopRootMigrationOptions) {
  const scope = resolveScope(options);
  await fs.mkdir(scope.dataRoot, { recursive: true });
  const existing = await readState(path.join(scope.dataRoot, MIGRATION_STATE));
  if (existing) return;
  await writeState(path.join(scope.dataRoot, MIGRATION_STATE), {
    schemaVersion: SCHEMA_VERSION,
    mode: "fresh",
    files: 0,
    bytes: 0
  });
}

export async function migrateLegacyDesktopData(
  options: DesktopRootMigrationOptions
): Promise<DesktopRootMigrationResult> {
  const scope = resolveScope(options);
  await fs.mkdir(scope.dataRoot, { recursive: true });
  await recoverDesktopRootMigration(scope);
  const statePath = path.join(scope.dataRoot, MIGRATION_STATE);
  if (await readState(statePath)) throw new Error("旧版数据迁移已完成或用户已选择以空数据启动");

  const directories = await scanSourceDirectories(scope.legacyDataRoot);
  if (directories.length === 0) throw new Error("没有找到可迁移的旧版数据");
  const bytes = directories.reduce(
    (total, item) => total + item.entries.reduce((size, entry) => size + entry.bytes, 0),
    0
  );
  const files = directories.reduce((total, item) => total + item.entries.length, 0);
  const freeBytes = await availableBytes(scope.dataRoot);
  if (freeBytes !== undefined && freeBytes < bytes) throw new Error("目标磁盘空间不足；旧数据保持不变");

  const id = crypto.randomBytes(12).toString("hex");
  const stagingRoot = path.join(scope.dataRoot, `.desktop-migration-staging-${id}`);
  const backupRoot = path.join(scope.dataRoot, ".desktop-migration-recovery", id);
  const journalPath = path.join(scope.dataRoot, MIGRATION_JOURNAL);
  const journal: MigrationJournal = {
    schemaVersion: SCHEMA_VERSION,
    id,
    state: "copying",
    dataRoot: scope.dataRoot,
    sourceRoot: scope.legacyDataRoot,
    stagingRoot,
    backupRoot,
    directories: await Promise.all(
      directories.map(async (directory) => ({
        ...directory,
        existed: await pathExists(path.join(scope.dataRoot, directory.name))
      }))
    ),
    files,
    bytes
  };

  try {
    await writeJsonAtomic(journalPath, journal);
    await fs.mkdir(stagingRoot, { recursive: true });
    for (const directory of directories) await copyAndVerifyDirectory(scope.legacyDataRoot, stagingRoot, directory);
    await verifyStagedDirectories(stagingRoot, directories);
    journal.state = "staged";
    await writeJsonAtomic(journalPath, journal);

    await fs.mkdir(backupRoot, { recursive: true });
    journal.state = "switching";
    await writeJsonAtomic(journalPath, journal);
    for (const directory of directories) {
      const destination = path.join(scope.dataRoot, directory.name);
      const staged = path.join(stagingRoot, directory.name);
      const previous = path.join(backupRoot, directory.name);
      if (await pathExists(destination)) {
        await fs.mkdir(path.dirname(previous), { recursive: true });
        await fs.rename(destination, previous);
      }
      await fs.rename(staged, destination);
      await writeJsonAtomic(journalPath, journal);
    }

    await verifyStagedDirectories(scope.dataRoot, directories);
    const committedJournal: MigrationJournal = {
      ...journal,
      state: "committed",
      completedAt: new Date().toISOString()
    };
    await writeJsonAtomic(journalPath, committedJournal);
    Object.assign(journal, committedJournal);
    await writeState(statePath, { schemaVersion: SCHEMA_VERSION, mode: "migrated", id, files, bytes });
  } catch (error) {
    if (journal.state === "committed") {
      throw new Error(`旧版数据已完成切换，恢复记录已保留；请重新启动应用完成迁移收尾：${errorMessage(error)}`);
    }
    try {
      await rollbackDesktopRootMigration(journal);
      await fs.rm(stagingRoot, { recursive: true, force: true });
      await fs.rm(journalPath, { force: true });
    } catch (rollbackError) {
      throw new Error(
        `旧版数据迁移失败，自动回退也未完成；迁移日志已保留供下次启动恢复：${errorMessage(error)}；${errorMessage(rollbackError)}`
      );
    }
    throw new Error(`旧版数据迁移未完成，旧目录未删除：${errorMessage(error)}`);
  }

  // The committed journal is the durable decision. Cleanup is best-effort; a
  // later startup will finish it without rolling back a successful migration.
  await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
  await fs.rm(journalPath, { force: true }).catch(() => undefined);
  return {
    id,
    files,
    bytes,
    sourceDirectory: scope.legacyDataRoot,
    destinationDirectory: scope.dataRoot
  };
}

async function recoverDesktopRootMigration(scope: { dataRoot: string; legacyDataRoot: string }) {
  const journalPath = path.join(scope.dataRoot, MIGRATION_JOURNAL);
  let journal: MigrationJournal | undefined;
  try {
    const parsed = JSON.parse(await fs.readFile(journalPath, "utf8")) as MigrationJournal;
    journal = validateJournal(parsed, scope);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new Error("检测到损坏的桌面数据迁移日志；请先备份 data 目录再修复");
  }

  if (journal.state === "committed") {
    await writeState(path.join(scope.dataRoot, MIGRATION_STATE), {
      schemaVersion: SCHEMA_VERSION,
      mode: "migrated",
      id: journal.id,
      files: journal.files,
      bytes: journal.bytes
    });
    await fs.rm(journal.stagingRoot, { recursive: true, force: true });
    await fs.rm(journalPath, { force: true });
    return;
  }

  if (journal.state === "switching") await rollbackDesktopRootMigration(journal);
  await fs.rm(journal.stagingRoot, { recursive: true, force: true });
  await fs.rm(journalPath, { force: true });
}

async function rollbackDesktopRootMigration(journal: MigrationJournal) {
  const failedRoot = path.join(journal.dataRoot, ".desktop-migration-recovery", journal.id, "failed-target");
  for (const directory of [...journal.directories].reverse()) {
    const destination = path.join(journal.dataRoot, directory.name);
    const previous = path.join(journal.backupRoot, directory.name);
    const hasPrevious = await pathExists(previous);
    if (hasPrevious) {
      if (await pathExists(destination)) {
        const failed = path.join(failedRoot, directory.name);
        await fs.mkdir(path.dirname(failed), { recursive: true });
        await fs.rename(destination, failed);
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(previous, destination);
    } else if (
      !directory.existed &&
      !(await pathExists(path.join(journal.stagingRoot, directory.name))) &&
      (await pathExists(destination))
    ) {
      const failed = path.join(failedRoot, directory.name);
      await fs.mkdir(path.dirname(failed), { recursive: true });
      await fs.rename(destination, failed);
    }
  }
}

async function scanSourceDirectories(sourceRoot: string): Promise<DirectoryPlan[]> {
  const plans: DirectoryPlan[] = [];
  for (const name of MIGRATED_DIRECTORIES) {
    const directory = path.join(sourceRoot, name);
    const stat = await fs.lstat(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!stat) continue;
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`旧版数据目录类型无效：${name}`);
    plans.push({ name, existed: false, entries: await inventoryDirectory(directory) });
  }
  return plans;
}

async function inventoryDirectory(root: string): Promise<InventoryEntry[]> {
  const entries: InventoryEntry[] = [];
  async function walk(directory: string, prefix: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (
        !prefix &&
        path.basename(root) === "profile" &&
        ["SingletonLock", "SingletonCookie", "SingletonSocket"].includes(entry.name)
      ) {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const stat = await fs.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new Error(`旧版数据包含链接，迁移已停止：${relativePath}`);
      if (stat.isDirectory()) await walk(fullPath, relativePath);
      else if (stat.isFile()) entries.push({ relativePath, bytes: stat.size });
      else throw new Error(`旧版数据包含不支持的文件类型：${relativePath}`);
    }
  }
  await walk(root, "");
  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function copyAndVerifyDirectory(sourceRoot: string, stagingRoot: string, plan: DirectoryPlan) {
  const source = path.join(sourceRoot, plan.name);
  const target = path.join(stagingRoot, plan.name);
  await fs.mkdir(target, { recursive: true });
  for (const entry of plan.entries) {
    const sourceFile = path.join(source, ...entry.relativePath.split("/"));
    const targetFile = path.join(target, ...entry.relativePath.split("/"));
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    const sourceHash = crypto.createHash("sha256");
    const hashingTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sourceHash.update(chunk);
        callback(null, chunk);
      }
    });
    await pipeline(createReadStream(sourceFile), hashingTransform, createWriteStream(targetFile, { flags: "wx" }));
    const sourceDigest = sourceHash.digest("hex");
    const targetDigest = await sha256File(targetFile);
    if (targetDigest !== sourceDigest) throw new Error(`文件校验失败：${entry.relativePath}`);
  }
  const actual = await inventoryDirectory(target);
  if (JSON.stringify(actual) !== JSON.stringify(plan.entries)) throw new Error(`目录文件清单不一致：${plan.name}`);
}

async function verifyStagedDirectories(root: string, plans: DirectoryPlan[]) {
  for (const plan of plans) {
    const directory = path.join(root, plan.name);
    const actual = await inventoryDirectory(directory);
    if (JSON.stringify(actual) !== JSON.stringify(plan.entries)) throw new Error(`目录校验失败：${plan.name}`);
  }
}

async function sha256File(filePath: string) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function availableBytes(directory: string): Promise<number | undefined> {
  try {
    const stats = await fs.statfs(directory);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return undefined;
  }
}

async function readState(
  filePath: string
): Promise<{ schemaVersion: number; bytes: number; files: number } | undefined> {
  try {
    const value = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>;
    if (
      value.schemaVersion !== SCHEMA_VERSION ||
      !["fresh", "migrated"].includes(String(value.mode)) ||
      !Number.isSafeInteger(value.bytes) ||
      !Number.isSafeInteger(value.files)
    )
      throw new Error();
    return { schemaVersion: SCHEMA_VERSION, bytes: Number(value.bytes), files: Number(value.files) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error("桌面数据位置记录无效；请先备份 data 目录再修复");
  }
}

async function writeState(filePath: string, value: Record<string, unknown>) {
  await writeJsonAtomic(filePath, value);
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function validateJournal(
  value: MigrationJournal,
  scope: { dataRoot: string; legacyDataRoot: string }
): MigrationJournal {
  const allowedStates = ["copying", "staged", "switching", "committed"];
  if (
    value.schemaVersion !== SCHEMA_VERSION ||
    !/^[a-f0-9]{24}$/.test(value.id) ||
    !allowedStates.includes(value.state) ||
    path.resolve(value.dataRoot) !== scope.dataRoot ||
    path.resolve(value.sourceRoot) !== scope.legacyDataRoot ||
    path.resolve(value.stagingRoot) !== path.join(scope.dataRoot, `.desktop-migration-staging-${value.id}`) ||
    path.resolve(value.backupRoot) !== path.join(scope.dataRoot, ".desktop-migration-recovery", value.id) ||
    !Array.isArray(value.directories) ||
    value.directories.some(
      (item) =>
        !item ||
        !(MIGRATED_DIRECTORIES as readonly string[]).includes(item.name) ||
        typeof item.existed !== "boolean" ||
        !Array.isArray(item.entries) ||
        item.entries.some(
          (entry) =>
            !entry ||
            typeof entry.relativePath !== "string" ||
            path.isAbsolute(entry.relativePath) ||
            entry.relativePath.split(/[\\/]/).some((part) => part === ".." || part === "") ||
            !Number.isSafeInteger(entry.bytes) ||
            entry.bytes < 0
        )
    ) ||
    new Set(value.directories.map((item) => item.name)).size !== value.directories.length ||
    !Number.isSafeInteger(value.files) ||
    value.files < 0 ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0
  )
    throw new Error("Invalid migration journal");
  return value;
}

function resolveScope(options: DesktopRootMigrationOptions) {
  const dataRoot = path.resolve(options.dataRoot);
  const legacyDataRoot = path.resolve(options.legacyDataRoot);
  if (pathsOverlap(dataRoot, legacyDataRoot)) throw new Error("新旧桌面数据目录不能重叠，请重新选择安装目录");
  return { dataRoot, legacyDataRoot };
}

function pathsOverlap(left: string, right: string) {
  return isInside(left, right) || isInside(right, left) || left.toLowerCase() === right.toLowerCase();
}

function isInside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return Boolean(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function pathExists(candidate: string) {
  return fs.access(candidate).then(
    () => true,
    () => false
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.replace(/[\r\n]/g, " ").slice(0, 240) : "未知错误";
}
