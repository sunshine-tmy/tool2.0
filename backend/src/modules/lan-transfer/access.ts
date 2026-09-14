import { randomBytes, timingSafeEqual } from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { fail } from "@toolbox/shared";
import type { AppConfig } from "../../config";

type LanAccessAction = "read" | "upload" | "manage";

export function createLanAccessController(config: AppConfig) {
  const cookieName = "toolbox_lan_session";
  const sessionLifetimeSeconds = 12 * 60 * 60;
  const sessions = new Map<string, number>();

  function readToken(request: FastifyRequest) {
    const cookieHeader = request.headers.cookie ?? "";
    const token = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    return token ? decodeURIComponent(token) : undefined;
  }

  function isAuthenticated(request: FastifyRequest) {
    if (!config.lanTransferPin) return true;
    const token = readToken(request);
    if (!token) return false;
    const expiresAt = sessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  function can(request: FastifyRequest, action: LanAccessAction) {
    // In LAN deployment the global administrator hook has already authorized
    // every management route before this controller runs. Avoid requiring a
    // second LAN PIN while keeping guest modes limited to transfer operations.
    if (action === "manage" && config.deploymentMode === "lan") return true;
    if (!config.lanTransferPin || isAuthenticated(request)) return true;
    if (action === "manage") return false;
    if (config.lanTransferGuestMode === "full") return true;
    if (config.lanTransferGuestMode === "upload-only") return action === "upload";
    if (config.lanTransferGuestMode === "download-only") return action === "read";
    return false;
  }

  return {
    isAuthenticated,
    can,
    authorize(request: FastifyRequest, reply: FastifyReply, action: LanAccessAction) {
      if (can(request, action)) return true;
      const status = config.lanTransferPin ? 401 : 403;
      reply
        .code(status)
        .send(fail(config.lanTransferPin ? "LAN_PIN_REQUIRED" : "LAN_ACCESS_DENIED", "需要管理 PIN 才能执行此操作"));
      return false;
    },
    login(pin: string) {
      if (!config.lanTransferPin || safeStringEquals(pin, config.lanTransferPin)) {
        const token = randomBytes(24).toString("base64url");
        sessions.set(token, Date.now() + sessionLifetimeSeconds * 1000);
        return token;
      }
      return undefined;
    },
    logout(request: FastifyRequest) {
      const token = readToken(request);
      if (token) sessions.delete(token);
    },
    sessionCookie(token: string) {
      return `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${sessionLifetimeSeconds}`;
    },
    expiredSessionCookie() {
      return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`;
    }
  };
}

export type LanAccessController = ReturnType<typeof createLanAccessController>;

export function createLanAuditLog(logPath: string) {
  let queue = Promise.resolve();
  return {
    write(event: string, request: FastifyRequest, details: unknown = undefined) {
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
        remoteAddress: request.ip,
        details
      });
      const operation = queue.then(async () => {
        await fsp.mkdir(path.dirname(logPath), { recursive: true });
        await fsp.appendFile(logPath, `${entry}\n`, "utf8");
      });
      queue = operation.catch(() => undefined);
      return operation.catch(() => undefined);
    }
  };
}

export function getLanWebUrls(port: number) {
  const addresses = Object.values(os.networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254."))
    .map((item) => item.address);
  return Array.from(new Set(addresses)).map((address) => `http://${address}:${port}/tools/lan-transfer`);
}

function safeStringEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
