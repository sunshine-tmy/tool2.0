/**
 * 中文模块说明：为 kkFileView 提供短时、单文件、不可枚举的 Office 预览源地址。
 *
 * kkFileView 会由自身进程拉取待转换文档，不能携带浏览器的管理员 Cookie。这里不放宽
 * 文件下载接口权限，而是由已通过 read 权限校验的用户签发一次预览票据；票据仅绑定一个
 * 文件，并在很短时间后失效。这样转换服务既看不到存储路径，也无法借机读取其他文件。
 */
import { randomBytes } from "node:crypto";
import type { AppConfig } from "../../config";
import type { LanFileRecord } from "@toolbox/shared";

type OfficePreviewTicket = {
  fileId: string;
  expiresAt: number;
};

type LanOfficePreview = {
  viewerUrl: string;
  expiresAt: string;
};

export function createLanOfficePreviewService(config: AppConfig, basePath: string) {
  const tickets = new Map<string, OfficePreviewTicket>();

  function clearExpiredTickets(now = Date.now()) {
    for (const [token, ticket] of tickets) {
      if (ticket.expiresAt <= now) tickets.delete(token);
    }
  }

  function issue(file: LanFileRecord): LanOfficePreview | undefined {
    if (!config.lanOfficePreviewUrl || !config.lanOfficePreviewSourceBaseUrl) return undefined;
    clearExpiredTickets();

    const expiresAt = Date.now() + config.lanOfficePreviewTicketLifetimeSeconds * 1000;
    const ticket = randomBytes(32).toString("base64url");
    tickets.set(ticket, { fileId: file.id, expiresAt });

    // 路径末尾只保留受控扩展名，确保 kkFileView 能稳定识别 docx/xlsx/pptx 等格式，
    // 同时避免在可复制的预览地址中暴露原始文件名。路由端实际只信任 ticket 与 fileId 的绑定。
    const sourceFileName = `preview.${file.extension || "bin"}`;
    const sourceUrl = new URL(
      `${basePath}/files/${encodeURIComponent(file.id)}/office-source/${sourceFileName}`,
      `${config.lanOfficePreviewSourceBaseUrl}/`
    );
    sourceUrl.searchParams.set("ticket", ticket);

    // kkFileView 的 /onlinePreview 接口要求 source URL 做 Base64 后作为 url 参数传入。
    const encodedSource = Buffer.from(sourceUrl.toString(), "utf8").toString("base64");
    const viewerUrl = new URL("onlinePreview", `${config.lanOfficePreviewUrl}/`);
    viewerUrl.searchParams.set("url", encodedSource);

    return { viewerUrl: viewerUrl.toString(), expiresAt: new Date(expiresAt).toISOString() };
  }

  function allows(fileId: string, ticket: string | undefined) {
    if (!ticket) return false;
    const record = tickets.get(ticket);
    if (!record) return false;
    if (record.expiresAt <= Date.now()) {
      tickets.delete(ticket);
      return false;
    }
    return record.fileId === fileId;
  }

  return {
    issue,
    allows,
    close() {
      tickets.clear();
    }
  };
}

export type LanOfficePreviewService = ReturnType<typeof createLanOfficePreviewService>;
