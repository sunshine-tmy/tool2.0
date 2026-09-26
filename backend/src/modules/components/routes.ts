/** 中文模块说明：能力包管理 API，只接收目录中的能力 id，不接受 renderer 提供的下载地址或本机路径。 */
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  ApiFailureSchema,
  ComponentIdParamsSchema,
  ComponentJobIdParamsSchema,
  ComponentJobSchema,
  ComponentPackageListSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ComponentIdParams,
  type ComponentJob,
  type ComponentJobIdParams
} from "@toolbox/shared";
import { ComponentManager, ComponentManagerError } from "./component-manager";

export function registerComponentRoutes(
  app: FastifyInstance,
  manager: ComponentManager,
  options: { allowOfflineImport?: boolean } = {}
) {
  app.get(
    "/api/v1/components",
    { schema: { response: { 200: apiSuccessSchema(ComponentPackageListSchema) } } },
    async () => ok(await manager.list())
  );

  app.post<{ Params: ComponentIdParams }>(
    "/api/v1/components/:componentId/install",
    {
      schema: {
        params: ComponentIdParamsSchema,
        response: {
          200: apiSuccessSchema(ComponentJobSchema),
          404: ApiFailureSchema,
          409: ApiFailureSchema,
          422: ApiFailureSchema,
          507: ApiFailureSchema,
          500: ApiFailureSchema
        }
      }
    },
    async (request, reply) => runComponentOperation(reply, () => manager.startInstall(request.params.componentId))
  );

  app.post<{ Params: ComponentIdParams }>(
    "/api/v1/components/:componentId/reinstall",
    {
      schema: {
        params: ComponentIdParamsSchema,
        response: {
          200: apiSuccessSchema(ComponentJobSchema),
          404: ApiFailureSchema,
          409: ApiFailureSchema,
          422: ApiFailureSchema,
          500: ApiFailureSchema
        }
      }
    },
    async (request, reply) => runComponentOperation(reply, () => manager.startReinstall(request.params.componentId))
  );

  if (options.allowOfflineImport) {
    app.post<{ Params: ComponentIdParams }>(
      "/api/v1/components/:componentId/offline-import",
      {
        bodyLimit: manager.getOfflineImportBodyLimit(),
        schema: {
          params: ComponentIdParamsSchema,
          response: {
            200: apiSuccessSchema(ComponentJobSchema),
            404: ApiFailureSchema,
            409: ApiFailureSchema,
            413: ApiFailureSchema,
            422: ApiFailureSchema,
            507: ApiFailureSchema,
            500: ApiFailureSchema
          }
        }
      },
      async (request, reply) => {
        try {
          if (!request.isMultipart()) {
            return reply.code(422).send(fail("COMPONENT_IMPORT_INVALID", "请选择能力包归档文件"));
          }
          const requirements = await manager.getOfflineImportRequirements(request.params.componentId);
          const parts = request.parts({
            limits: {
              files: requirements.archives.length,
              fields: 0,
              parts: requirements.archives.length,
              fileSize: Math.max(...requirements.archives.map((archive) => archive.bytes))
            }
          });
          return ok(await manager.startOfflineImport(request.params.componentId, offlineArchiveUploads(parts)));
        } catch (error) {
          // Stop retaining any unread multipart payload after a preflight or stream error.
          request.raw.resume();
          if (error instanceof ComponentManagerError) return sendComponentError(reply, error);
          return reply.code(422).send(fail("COMPONENT_IMPORT_INVALID", "上传请求无效、已中断或超过能力包限制"));
        }
      }
    );
  }

  app.delete<{ Params: ComponentIdParams }>(
    "/api/v1/components/:componentId",
    {
      schema: {
        params: ComponentIdParamsSchema,
        response: {
          200: apiSuccessSchema(ComponentJobSchema),
          404: ApiFailureSchema,
          409: ApiFailureSchema,
          500: ApiFailureSchema
        }
      }
    },
    async (request, reply) => runComponentOperation(reply, () => manager.startUninstall(request.params.componentId))
  );

  app.get<{ Params: ComponentJobIdParams }>(
    "/api/v1/component-jobs/:jobId",
    {
      schema: {
        params: ComponentJobIdParamsSchema,
        response: { 200: apiSuccessSchema(ComponentJobSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      try {
        return ok(await manager.getJob(request.params.jobId));
      } catch (error) {
        return sendComponentError(reply, error);
      }
    }
  );

  app.delete<{ Params: ComponentJobIdParams }>(
    "/api/v1/component-jobs/:jobId",
    {
      schema: {
        params: ComponentJobIdParamsSchema,
        response: { 200: apiSuccessSchema(ComponentJobSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      try {
        return ok(await manager.cancelJob(request.params.jobId));
      } catch (error) {
        return sendComponentError(reply, error);
      }
    }
  );

  app.get<{ Params: ComponentJobIdParams }>(
    "/api/v1/component-jobs/:jobId/events",
    {
      schema: {
        params: ComponentJobIdParamsSchema,
        response: { 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      try {
        await manager.getJob(request.params.jobId);
        reply.hijack();
        reply.raw.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no"
        });
        const send = (value: ComponentJob) =>
          reply.raw.write("event: component-job\n" + "data: " + JSON.stringify(value) + "\n\n");
        const unsubscribe = manager.subscribe(request.params.jobId, (value) => {
          send(value);
          if (value.state === "completed" || value.state === "failed" || value.state === "cancelled") reply.raw.end();
        });
        const heartbeat = setInterval(() => reply.raw.write(": keep-alive\n\n"), 15_000);
        reply.raw.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
      } catch (error) {
        return sendComponentError(reply, error);
      }
    }
  );
}

async function* offlineArchiveUploads(parts: AsyncIterableIterator<import("@fastify/multipart").Multipart>) {
  for await (const part of parts) {
    if (part.type !== "file") {
      throw new ComponentManagerError("COMPONENT_IMPORT_INVALID", "请求中只能包含能力包文件");
    }
    yield { fieldName: part.fieldname, filename: part.filename, stream: part.file };
  }
}

async function runComponentOperation(reply: FastifyReply, operation: () => Promise<unknown>) {
  try {
    return ok(await operation());
  } catch (error) {
    return sendComponentError(reply, error);
  }
}

function sendComponentError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof ComponentManagerError)) {
    return reply.code(500).send(fail("COMPONENT_INSTALL_FAILED", "能力管理操作失败"));
  }
  const statusCode =
    error.code === "COMPONENT_NOT_FOUND" || error.code === "COMPONENT_JOB_NOT_FOUND"
      ? 404
      : error.code === "COMPONENT_MANIFEST_INVALID" || error.code === "COMPONENT_IMPORT_INVALID"
        ? 422
        : error.code === "COMPONENT_DISK_SPACE_LOW"
          ? 507
          : error.code === "COMPONENT_IN_USE" ||
              error.code === "COMPONENT_OPERATION_CONFLICT" ||
              error.code === "COMPONENT_DEPENDENCY_MISSING" ||
              error.code === "COMPONENT_NOT_INSTALLED" ||
              error.code === "COMPONENT_JOB_NOT_CANCELLABLE"
            ? 409
            : 500;
  return reply.code(statusCode).send(fail(error.code, error.message));
}
