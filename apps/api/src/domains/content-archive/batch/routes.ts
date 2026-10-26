/** Spreadsheet endpoints retain existing LAN administrator/CSRF hooks and never write the uploaded workbook. */
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { Value } from "@sinclair/typebox/value";
import {
  ARCHIVE_IMPORT_MAX_BYTES,
  ARCHIVE_IMPORT_ROW_LABELS,
  ApiFailureSchema,
  ArchiveImportPreviewSchema,
  ArchiveImportBatchSchema,
  ArchiveImportCreateSchema,
  ArchiveImportListSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveRemovalSchema,
  apiSuccessSchema,
  ok,
  fail,
  type ArchiveImportCreate,
  type XhsArchiveIdParams
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../../security/request-quotas";
import { ArchiveTaskError } from "../core/provider";
import { readArchiveSpreadsheet, archiveImportCsv } from "./spreadsheet";
import type { ArchiveImportService } from "./service";

export function registerArchiveImportRoutes(app: FastifyInstance, service: ArchiveImportService) {
  const base = "/api/v1/tools/media-archive/import";
  const errors = {
    400: ApiFailureSchema,
    404: ApiFailureSchema,
    409: ApiFailureSchema,
    413: ApiFailureSchema,
    429: ApiFailureSchema,
    503: ApiFailureSchema
  };
  const errorResponse = (reply: FastifyReply, error: unknown) => {
    if (error instanceof ArchiveTaskError) return reply.code(error.statusCode).send(fail(error.code, error.message));
    throw error;
  };
  app.get(`${base}/template.csv`, async (_request, reply) =>
    reply
      .header("cache-control", "no-store")
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="archive-import-template.csv"')
      .send(archiveImportCsv([["作品链接", "平台"]]))
  );
  app.post(
    `${base}/preview`,
    {
      bodyLimit: ARCHIVE_IMPORT_MAX_BYTES + 64 * 1024,
      config: REQUEST_QUOTAS.lanUpload,
      schema: { response: { 200: apiSuccessSchema(ArchiveImportPreviewSchema), ...errors } }
    },
    async (request, reply) => {
      try {
        const upload = await request.file({
          limits: { fileSize: ARCHIVE_IMPORT_MAX_BYTES, files: 1, fields: 0 },
          throwFileSizeLimit: false
        });
        if (!upload || upload.fieldname !== "file")
          throw new ArchiveTaskError("ARCHIVE_IMPORT_FILE_REQUIRED", "请选择一个 Excel 或 CSV 文件", 400);
        const bytes = await upload.toBuffer();
        if (upload.file.truncated) throw new ArchiveTaskError("ARCHIVE_IMPORT_FILE_TOO_LARGE", "表格最大 2 MiB", 413);
        const sourceName = path.basename(upload.filename).slice(0, 180) || "import.csv";
        let sheet;
        try {
          sheet = await readArchiveSpreadsheet(bytes, upload.filename);
        } catch (error) {
          if (error instanceof ArchiveTaskError) throw error;
          throw new ArchiveTaskError(
            "ARCHIVE_IMPORT_FILE_INVALID",
            "无法解析表格，请使用未加密的 .xlsx 或有效 CSV",
            400
          );
        }
        return ok(await service.preview(sourceName, sheet.sheetName, sheet.rows));
      } catch (error) {
        return errorResponse(reply, error);
      }
    }
  );
  app.post<{ Body: ArchiveImportCreate }>(
    `${base}/batches`,
    {
      bodyLimit: 4 * 1024 * 1024,
      config: REQUEST_QUOTAS.translationBatch,
      preValidation: async (request, reply) => {
        if (!Value.Check(ArchiveImportCreateSchema, request.body))
          return reply.code(400).send(fail("ARCHIVE_IMPORT_INPUT_INVALID", "批量归档参数无效，每批最多 100 行"));
      },
      schema: {
        body: ArchiveImportCreateSchema,
        response: { 202: apiSuccessSchema(ArchiveImportBatchSchema), ...errors }
      }
    },
    async (request, reply) => {
      try {
        return reply.code(202).send(ok(await service.create(request.body)));
      } catch (error) {
        return errorResponse(reply, error);
      }
    }
  );
  app.get(`${base}/batches`, { schema: { response: { 200: apiSuccessSchema(ArchiveImportListSchema) } } }, async () =>
    ok(service.list())
  );
  const get = (id: string) => {
    const batch = service.get(id);
    if (!batch) throw new ArchiveTaskError("ARCHIVE_IMPORT_NOT_FOUND", "批次不存在", 404);
    return batch;
  };
  app.get<{ Params: XhsArchiveIdParams }>(
    `${base}/batches/:id`,
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(ArchiveImportBatchSchema), ...errors }
      }
    },
    async (request, reply) => {
      try {
        return ok(get(request.params.id));
      } catch (error) {
        return errorResponse(reply, error);
      }
    }
  );
  for (const action of ["cancel", "retry"] as const) {
    app.post<{ Params: XhsArchiveIdParams }>(
      `${base}/batches/:id/${action}`,
      {
        config: REQUEST_QUOTAS.translationBatch,
        schema: {
          params: XhsArchiveIdParamsSchema,
          response: { 200: apiSuccessSchema(ArchiveImportBatchSchema), ...errors }
        }
      },
      async (request, reply) => {
        try {
          get(request.params.id);
          return ok(await service[action](request.params.id));
        } catch (error) {
          return errorResponse(reply, error);
        }
      }
    );
  }
  app.delete<{ Params: XhsArchiveIdParams }>(
    `${base}/batches/:id`,
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveRemovalSchema), ...errors }
      }
    },
    async (request, reply) => {
      try {
        get(request.params.id);
        await service.remove(request.params.id);
        return ok({ removed: true, mediaCount: 0, releasedBytes: 0 });
      } catch (error) {
        return errorResponse(reply, error);
      }
    }
  );
  app.get<{ Params: XhsArchiveIdParams }>(
    `${base}/batches/:id/results.csv`,
    { config: REQUEST_QUOTAS.batchDownload, schema: { params: XhsArchiveIdParamsSchema } },
    async (request, reply) => {
      try {
        const batch = get(request.params.id);
        const csv = archiveImportCsv([
          ["原始行号", "作品链接", "原平台", "识别平台", "状态", "进度", "结果或原因", "错误码", "归档ID"],
          ...batch.rows.map((row) => [
            row.rowNumber,
            row.inputUrl,
            row.inputPlatform,
            row.platform,
            ARCHIVE_IMPORT_ROW_LABELS[row.status],
            row.progress,
            row.message,
            row.errorCode,
            row.archiveId
          ])
        ]);
        return reply
          .header("cache-control", "no-store")
          .header("content-type", "text/csv; charset=utf-8")
          .header("content-disposition", `attachment; filename="archive-import-${batch.id}.csv"`)
          .send(csv);
      } catch (error) {
        return errorResponse(reply, error);
      }
    }
  );
}
