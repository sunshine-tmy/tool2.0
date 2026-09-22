/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import fs from "node:fs";
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
        const categories = (await (deps.cleanupRunner ?? ((args) => runCleanup(deps.config, args)))([
          "--json-web"
        ])) as CleanupCategory[];
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
      const ids = Array.isArray(body.ids) ? body.ids.filter((value): value is string => typeof value === "string") : [];
      if (!ids.length) return reply.code(400).send(fail("CLEANUP_SELECTION_REQUIRED", "请至少选择一个清理分类"));
      if (ids.some((id) => id === "build" || id === "packages"))
        return reply
          .code(400)
          .send(fail("CLEANUP_BUILD_REQUIRES_TERMINAL", "网页运行期间不能清理构建产物，请停止服务后使用终端清理脚本"));
      try {
        const dryRun = body.dryRun === true;
        const results = (await (deps.cleanupRunner ?? ((args) => runCleanup(deps.config, args)))([
          `--execute=${ids.join(",")}`,
          ...(dryRun ? ["--dry-run"] : [])
        ])) as CleanupCategory[];
        // 演练必须是严格只读操作；即使清理脚本没有触碰文件，也绝不能删除或重建任何元数据。
        if (!dryRun) await syncMetadataAfterCleanup(app, deps, results);
        return ok(results);
      } catch (error) {
        return reply.code(400).send(fail("CLEANUP_FAILED", message(error)));
      }
    }
  );
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
