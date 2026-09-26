/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  CleanupInspectionSchema,
  CleanupResultsSchema,
  apiSuccessSchema,
  fail,
  ok
} from "@toolbox/shared";
import type { AppConfig } from "../config";
import { reconcileDomainRecords } from "../database/domain-consistency";
import { reconcileLanStorage } from "../database/storage-consistency";
import type { ToolboxDatabase } from "../database/toolbox-database";
import type { XhsArchiveStore } from "./xhs-archive/store";

const execFileAsync = promisify(execFile);

type CleanupCategory = {
  id: string;
  label: string;
  risk: "low" | "medium" | "high";
  requiresStop: boolean;
  defaults: boolean;
  files: number;
  bytes: number;
  skippedFiles?: number;
  skippedBytes?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DESKTOP_CLEANUP_RULES = {
  logs: { label: "过期日志（7 天前）", maxAgeMs: 7 * DAY_MS },
  temp: { label: "旧临时文件（24 小时前）", maxAgeMs: DAY_MS }
} as const;
type DesktopCleanupId = keyof typeof DESKTOP_CLEANUP_RULES;

type MaintenanceDependencies = {
  config: AppConfig;
  database: ToolboxDatabase;
  xhsStore?: XhsArchiveStore;
  /** 仅供单元测试替换，生产环境始终执行受控的项目清理脚本。 */
  cleanupRunner?: (args: string[]) => Promise<CleanupCategory[]>;
};

export function registerMaintenanceRoutes(app: FastifyInstance, deps: MaintenanceDependencies) {
  app.get(
    "/api/v1/maintenance/cleanup",
    { schema: { response: { 200: apiSuccessSchema(CleanupInspectionSchema), 500: ApiFailureSchema } } },
    async (_request, reply) => {
      try {
        const categories = deps.config.desktopManagedCapabilities
          ? await inspectDesktopCleanup(deps.config)
          : ((await (deps.cleanupRunner ?? ((args) => runCleanup(deps.config, args)))([
              "--json-web"
            ])) as CleanupCategory[]);
        return ok(categories);
      } catch (error) {
        return reply.code(500).send(fail("CLEANUP_INSPECTION_FAILED", message(error)));
      }
    }
  );

  app.post(
    "/api/v1/maintenance/cleanup",
    {
      schema: {
        response: { 200: apiSuccessSchema(CleanupResultsSchema), 400: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const body = isRecord(request.body) ? request.body : {};
      const rawIds = Array.isArray(body.ids) ? body.ids : [];
      const ids = rawIds.filter((value): value is string => typeof value === "string");
      if (!ids.length) return reply.code(400).send(fail("CLEANUP_SELECTION_REQUIRED", "请至少选择一个清理分类"));
      if (!deps.config.desktopManagedCapabilities && ids.some((id) => id === "build" || id === "packages"))
        return reply
          .code(400)
          .send(fail("CLEANUP_BUILD_REQUIRES_TERMINAL", "网页运行期间不能清理构建产物，请停止服务后使用终端清理脚本"));
      try {
        const dryRun = body.dryRun === true;
        if (
          deps.config.desktopManagedCapabilities &&
          (rawIds.length !== ids.length || ids.some((id) => !isDesktopCleanupId(id)))
        ) {
          return reply.code(400).send(fail("CLEANUP_CATEGORY_NOT_ALLOWED", "桌面端仅允许清理超过期限的日志和临时文件"));
        }
        const results = deps.config.desktopManagedCapabilities
          ? await executeDesktopCleanup(deps.config, ids as DesktopCleanupId[], dryRun)
          : ((await (deps.cleanupRunner ?? ((args) => runCleanup(deps.config, args)))([
              `--execute=${ids.join(",")}`,
              ...(dryRun ? ["--dry-run"] : [])
            ])) as CleanupCategory[]);
        // 演练必须是严格只读操作；即使清理脚本没有触碰文件，也绝不能删除或重建任何元数据。
        if (!dryRun) await syncMetadataAfterCleanup(app, deps, results);
        return ok(results);
      } catch (error) {
        return reply.code(400).send(fail("CLEANUP_FAILED", message(error)));
      }
    }
  );
}

async function inspectDesktopCleanup(config: AppConfig): Promise<CleanupCategory[]> {
  return Promise.all(
    (Object.keys(DESKTOP_CLEANUP_RULES) as DesktopCleanupId[]).map(async (id) => {
      const rule = DESKTOP_CLEANUP_RULES[id];
      const files = await findExpiredDesktopFiles(config, id);
      return {
        id,
        label: rule.label,
        risk: "low" as const,
        requiresStop: false,
        defaults: false,
        files: files.length,
        bytes: files.reduce((total, file) => total + file.bytes, 0)
      };
    })
  );
}

async function executeDesktopCleanup(
  config: AppConfig,
  ids: DesktopCleanupId[],
  dryRun: boolean
): Promise<CleanupCategory[]> {
  const results: CleanupCategory[] = [];
  for (const id of new Set(ids)) {
    const rule = DESKTOP_CLEANUP_RULES[id];
    const files = await findExpiredDesktopFiles(config, id);
    let removedFiles = 0;
    let removedBytes = 0;
    let skippedFiles = 0;
    let skippedBytes = 0;
    if (!dryRun) {
      const cutoff = Date.now() - rule.maxAgeMs;
      for (const file of files) {
        try {
          const dataRoot = path.resolve(path.dirname(config.runtime.runtimeRoot));
          if (!(await hasSafeDirectoryChain(dataRoot, path.dirname(file.path)))) continue;
          // Recheck each entry immediately before unlinking; a file refreshed after inspection is retained.
          const current = await fsp.lstat(file.path);
          if (current.isSymbolicLink() || !current.isFile() || current.mtimeMs >= cutoff) continue;
          await fsp.unlink(file.path);
          removedFiles += 1;
          removedBytes += current.size;
        } catch (error) {
          if (isMissingFile(error)) continue;
          if (isLockedOrDenied(error)) {
            skippedFiles += 1;
            skippedBytes += file.bytes;
            continue;
          }
          throw error;
        }
      }
    }
    results.push({
      id,
      label: rule.label,
      risk: "low",
      requiresStop: false,
      defaults: false,
      files: dryRun ? files.length : removedFiles,
      bytes: dryRun ? files.reduce((total, file) => total + file.bytes, 0) : removedBytes,
      ...(skippedFiles ? { skippedFiles, skippedBytes } : {})
    });
  }
  return results;
}

type ExpiredDesktopFile = { path: string; bytes: number };

async function findExpiredDesktopFiles(config: AppConfig, id: DesktopCleanupId): Promise<ExpiredDesktopFile[]> {
  const dataRoot = path.resolve(path.dirname(config.runtime.runtimeRoot));
  const roots = desktopCleanupRoots(config, id, dataRoot);
  const cutoff = Date.now() - DESKTOP_CLEANUP_RULES[id].maxAgeMs;
  const files: ExpiredDesktopFile[] = [];

  for (const root of roots) {
    const relativeRoot = path.relative(dataRoot, root);
    if (!relativeRoot || relativeRoot.startsWith("..") || path.isAbsolute(relativeRoot)) {
      throw new Error("桌面清理目录超出应用数据目录");
    }
    if (!(await hasSafeDirectoryChain(dataRoot, root))) continue;
    await collectExpiredFiles(root, cutoff, files);
  }
  return files;
}

function desktopCleanupRoots(config: AppConfig, id: DesktopCleanupId, dataRoot: string) {
  if (id === "logs") return [path.join(dataRoot, "logs")];
  return [...new Set([path.join(dataRoot, "temp"), path.join(config.runtime.storageRoot, "temp")])];
}

async function hasSafeDirectoryChain(dataRoot: string, target: string) {
  let current = dataRoot;
  const relative = path.relative(dataRoot, target);
  try {
    const rootStats = await fsp.lstat(dataRoot);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) return false;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const stats = await fsp.lstat(current);
      if (!stats.isDirectory() || stats.isSymbolicLink()) return false;
    }
    return true;
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
}

async function collectExpiredFiles(directory: string, cutoff: number, files: ExpiredDesktopFile[]) {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fsp.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return;
    throw error;
  }
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    let stats: import("node:fs").Stats;
    try {
      stats = await fsp.lstat(entryPath);
    } catch (error) {
      if (isMissingFile(error)) continue;
      throw error;
    }
    // Never follow symbolic links or Windows junctions while traversing user data.
    if (stats.isSymbolicLink()) continue;
    if (stats.isDirectory()) {
      await collectExpiredFiles(entryPath, cutoff, files);
    } else if (stats.isFile() && stats.mtimeMs < cutoff) {
      files.push({ path: entryPath, bytes: stats.size });
    }
  }
}

function isDesktopCleanupId(value: string): value is DesktopCleanupId {
  return Object.hasOwn(DESKTOP_CLEANUP_RULES, value);
}

function isMissingFile(error: unknown) {
  return isFileSystemError(error) && error.code === "ENOENT";
}

function isLockedOrDenied(error: unknown) {
  return (
    isFileSystemError(error) && typeof error.code === "string" && ["EBUSY", "EACCES", "EPERM"].includes(error.code)
  );
}

function isFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}

async function syncMetadataAfterCleanup(
  app: FastifyInstance,
  deps: MaintenanceDependencies,
  results: CleanupCategory[]
) {
  // 只有完整删除的分类才可同步元数据。被占用的文件仍是用户可恢复的数据，不能因一次部分清理而丢失索引。
  const completed = new Set(results.filter((result) => !result.skippedFiles).map((result) => result.id));
  const steps: Array<() => Promise<unknown>> = [];
  if (completed.has("xhs-archive") && deps.xhsStore) {
    const store = deps.xhsStore;
    steps.push(() => store.purgeAll());
  }
  if (completed.has("lan-transfer")) steps.push(() => reconcileLanStorage(deps.config, deps.database));

  const domains: Array<"image-ai" | "edge-tts" | "chatterbox"> = [];
  if (completed.has("image-ai")) domains.push("image-ai");
  if (completed.has("voice")) domains.push("edge-tts", "chatterbox");
  if (domains.length) steps.push(() => reconcileDomainRecords(deps.config, deps.database, { mode: "remove", domains }));
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      app.log.warn({ err: error }, "清理后的元数据同步失败；未完成数据保持原状，可在停止相关服务后重试清理");
    }
  }
}

async function runCleanup(config: AppConfig, args: string[]) {
  const script = path.join(config.runtime.scriptsRoot, "clear-generated.mjs");
  if (!fs.existsSync(script)) throw new Error("找不到项目清理脚本");
  const { stdout } = await execFileAsync(process.execPath, [script, ...args], {
    cwd: config.runtime.appRoot,
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024
  });
  return JSON.parse(stdout.trim()) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function message(error: unknown) {
  const stderrLine = errorOutput((error as { stderr?: unknown } | null)?.stderr)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("Error:"));
  const messageLine =
    error instanceof Error
      ? error.message
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line.length > 0)
      : undefined;
  const text = stderrLine ?? messageLine ?? "清理失败";
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

function errorOutput(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
  return "";
}
