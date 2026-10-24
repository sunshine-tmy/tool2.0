import net from "node:net";
import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import {
  DiagnosticRunSchema,
  DiagnosticInputSchema,
  DiagnosticIdSchema,
  DiagnosticActionSchema,
  DiagnosticReportInputSchema,
  DiagnosticReportSchema,
  apiSuccessSchema,
  ok,
  fail
} from "@toolbox/shared";
import type { DiagnosticsService } from "./service";

const PlaybackSchema = Type.Object(
  { clientId: Type.String({ pattern: "^[A-Za-z0-9-]{1,80}$" }), active: Type.Boolean() },
  { additionalProperties: false }
);

function isLoopbackAddress(value: string): boolean {
  const address = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  if (net.isIP(address) === 4) return address.startsWith("127.");
  if (net.isIP(address) !== 6) return false;
  const normalized = new URL(`http://[${address}]`).hostname.slice(1, -1);
  return normalized === "::1" || /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/i.test(normalized);
}

function localWebOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return;
    if (url.hostname !== "localhost" && !isLoopbackAddress(url.hostname)) return;
    return url.origin;
  } catch {
    return;
  }
}

export function registerDiagnosticRoutes(app: FastifyInstance, service: DiagnosticsService) {
  const approvedOrigins = new Set(service.config.corsOrigins.map(localWebOrigin).filter(Boolean));
  // socket 必须为回环；转发链只能进一步限制权限，绝不能凭伪造的转发头把远程请求提升为本机。
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/v1/diagnostics")) return;
    const address = request.raw.socket.remoteAddress;
    const origin = request.headers.origin;
    const parsedOrigin = origin ? localWebOrigin(origin) : undefined;
    const forwarded = request.headers["x-forwarded-for"];
    const forwardedAddresses = typeof forwarded === "string" ? forwarded.split(",").map((value) => value.trim()) : [];
    const localForwarding =
      forwarded === undefined ||
      (typeof forwarded === "string" && forwardedAddresses.length <= 16 && forwardedAddresses.every(isLoopbackAddress));
    const localOrigin = origin === undefined || Boolean(parsedOrigin);
    // 本机两个主机名之间的 CORS 请求也可能被浏览器标为 cross-site，仅放行已配置的本机前端 Origin。
    const allowedFetchSite =
      request.headers["sec-fetch-site"] !== "cross-site" || Boolean(parsedOrigin && approvedOrigins.has(parsedOrigin));
    if (!address || !isLoopbackAddress(address) || !localOrigin || !allowedFetchSite || !localForwarding)
      return reply.code(403).send(fail("LOCAL_DIAGNOSTICS_ONLY", "诊断仅供本机使用"));
  });
  app.get("/api/v1/diagnostics", { schema: { response: { 200: apiSuccessSchema(DiagnosticRunSchema) } } }, async () =>
    ok(await service.snapshot())
  );
  app.post<{ Body: Static<typeof DiagnosticInputSchema> }>(
    "/api/v1/diagnostics/runs",
    { schema: { body: DiagnosticInputSchema, response: { 200: apiSuccessSchema(DiagnosticRunSchema) } } },
    async (request) => ok(await service.start(request.body))
  );
  app.get<{ Params: Static<typeof DiagnosticIdSchema> }>(
    "/api/v1/diagnostics/runs/:id",
    { schema: { params: DiagnosticIdSchema, response: { 200: apiSuccessSchema(DiagnosticRunSchema) } } },
    async (request) => ok(service.get(request.params.id))
  );
  app.delete<{ Params: Static<typeof DiagnosticIdSchema> }>(
    "/api/v1/diagnostics/runs/:id",
    { schema: { params: DiagnosticIdSchema, response: { 200: apiSuccessSchema(DiagnosticRunSchema) } } },
    async (request) => ok(service.cancel(request.params.id))
  );
  app.post<{ Body: Static<typeof DiagnosticActionSchema> }>(
    "/api/v1/diagnostics/actions",
    { schema: { body: DiagnosticActionSchema, response: { 200: apiSuccessSchema(DiagnosticRunSchema) } } },
    async (request) => ok(await service.action(request.body.componentId))
  );
  app.post<{ Body: Static<typeof DiagnosticReportInputSchema> }>(
    "/api/v1/diagnostics/reports",
    { schema: { body: DiagnosticReportInputSchema, response: { 200: apiSuccessSchema(DiagnosticReportSchema) } } },
    async (request) => ok(service.report(request.body.runId, request.body.includeEvents))
  );
  app.post<{ Body: Static<typeof PlaybackSchema> }>(
    "/api/v1/diagnostics/playback",
    { schema: { body: PlaybackSchema } },
    async (request) => {
      service.setPlayback(request.body.clientId, request.body.active);
      return ok({});
    }
  );
  app.addHook("onClose", async () => service.close());
}
