import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "../database/toolbox-database";

const COOKIE_NAME = "toolbox_admin";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type Session = { csrfToken: string; expiresAt: number };

export async function registerAdminSecurity(app: FastifyInstance, config: AppConfig, database: ToolboxDatabase) {
  const sessions = new Map<string, Session>();

  app.post(
    "/api/v1/session",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["pin"],
          properties: { pin: { type: "string", minLength: 4, maxLength: 128 } }
        }
      }
    },
    async (request, reply) => {
      const { pin } = request.body as { pin: string };
      if (!config.adminPin || !timingSafeEqual(pin, config.adminPin)) {
        await delayFailedLogin();
        database.appendAudit({ action: "admin.login", outcome: "denied", requestId: request.id });
        return reply.code(401).send({
          success: false,
          message: "Invalid administrator PIN",
          error: { code: "INVALID_ADMIN_PIN", message: "Invalid administrator PIN" }
        });
      }
      const sessionId = crypto.randomBytes(32).toString("base64url");
      const csrfToken = crypto.randomBytes(24).toString("base64url");
      sessions.set(sessionId, { csrfToken, expiresAt: Date.now() + SESSION_TTL_MS });
      reply.setCookie(COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        path: "/",
        maxAge: SESSION_TTL_MS / 1000
      });
      database.appendAudit({ action: "admin.login", outcome: "success", requestId: request.id });
      return { success: true, message: "ok", data: { csrfToken, expiresInSeconds: SESSION_TTL_MS / 1000 } };
    }
  );

  app.get("/api/v1/session", async (request, reply) => {
    const sessionId = request.cookies[COOKIE_NAME];
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session || session.expiresAt <= Date.now()) {
      if (sessionId) sessions.delete(sessionId);
      return reply.code(401).send({
        success: false,
        message: "Administrator session required",
        error: { code: "ADMIN_SESSION_REQUIRED", message: "Administrator session required" }
      });
    }
    return {
      success: true,
      message: "ok",
      data: { csrfToken: session.csrfToken, expiresInSeconds: Math.ceil((session.expiresAt - Date.now()) / 1000) }
    };
  });

  app.delete("/api/v1/session", async (request, reply) => {
    const id = request.cookies[COOKIE_NAME];
    if (id) sessions.delete(id);
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { success: true, message: "ok", data: null };
  });

  app.addHook("preHandler", async (request, reply) => {
    if (config.deploymentMode === "local" || SAFE_METHODS.has(request.method)) return;
    if (request.url.startsWith("/api/v1/session") && request.method === "POST") return;
    if (isGuestTransferRequest(request)) return;

    const sessionId = request.cookies[COOKIE_NAME];
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session || session.expiresAt <= Date.now()) {
      if (sessionId) sessions.delete(sessionId);
      return reply.code(401).send({
        success: false,
        message: "Administrator session required",
        error: { code: "ADMIN_SESSION_REQUIRED", message: "Administrator session required" }
      });
    }
    const origin = request.headers.origin;
    const csrf = request.headers["x-csrf-token"];
    if (!origin || !config.corsOrigins.includes(origin) || csrf !== session.csrfToken) {
      return reply.code(403).send({
        success: false,
        message: "CSRF validation failed",
        error: { code: "CSRF_VALIDATION_FAILED", message: "CSRF validation failed" }
      });
    }
  });

  app.addHook("onClose", async () => sessions.clear());
}

function isGuestTransferRequest(request: FastifyRequest) {
  return request.url.startsWith("/api/v1/tools/lan-transfer/");
}

function timingSafeEqual(actual: string, expected: string) {
  const actualDigest = crypto.createHash("sha256").update(actual).digest();
  const expectedDigest = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(actualDigest, expectedDigest);
}

function delayFailedLogin() {
  return new Promise((resolve) => setTimeout(resolve, 250));
}
