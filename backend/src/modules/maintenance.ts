/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import path from "node:path";
import fs from "node:fs";
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

const execFileAsync = promisify(execFile);

type CleanupCategory = {
  id: string;
  label: string;
  risk: "low" | "medium" | "high";
  requiresStop: boolean;
  defaults: boolean;
  files: number;
  bytes: number;
};

export function registerMaintenanceRoutes(app: FastifyInstance) {
  app.get(
    "/api/v1/maintenance/cleanup",
    { schema: { response: { 200: apiSuccessSchema(CleanupInspectionSchema), 500: ApiFailureSchema } } },
    async (_request, reply) => {
      try {
        const categories = (await runCleanup(["--json-web"])) as CleanupCategory[];
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
        const results = await runCleanup([
          `--execute=${ids.join(",")}`,
          ...(body.dryRun === true ? ["--dry-run"] : [])
        ]);
        return ok(results);
      } catch (error) {
        return reply.code(400).send(fail("CLEANUP_FAILED", message(error)));
      }
    }
  );
}

async function runCleanup(args: string[]) {
  const roots = [process.cwd(), path.resolve(process.cwd(), "..")];
  const root = roots.find((candidate) => fs.existsSync(path.join(candidate, "scripts", "clear-generated.mjs")));
  if (!root) throw new Error("找不到项目清理脚本");
  const script = path.join(root, "scripts", "clear-generated.mjs");
  const { stdout } = await execFileAsync(process.execPath, [script, ...args], {
    cwd: root,
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
  return error instanceof Error ? error.message : "清理失败";
}
