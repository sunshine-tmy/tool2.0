import {
  identifyArchiveLink,
  type ArchiveImportInputRow,
  type ArchiveImportPreview,
  type ArchivePlatform,
  type ArchivePlatformSelection
} from "@toolbox/shared/archive";
import type { ContentArchiveStore } from "../core/store";
import { ArchiveTaskError } from "../core/provider";

function archiveLinkIdentity(platform: ArchivePlatform, url: string) {
  const path = new URL(url).pathname;
  return platform === "xiaohongshu"
    ? /\/(?:explore|discovery\/item)\/([^/]+)\/?$/.exec(path)?.[1]
    : platform === "douyin"
      ? /\/(?:video|note|slides)\/(\d+)\/?$/.exec(path)?.[1]
      : /\/(?:video|photo)\/(\d+)\/?$/.exec(path)?.[1];
}
const platforms: Record<string, ArchivePlatformSelection> = {
  "": "auto",
  自动识别: "auto",
  自动: "auto",
  auto: "auto",
  小红书: "xiaohongshu",
  xiaohongshu: "xiaohongshu",
  xhs: "xiaohongshu",
  抖音: "douyin",
  douyin: "douyin",
  tiktok: "tiktok"
};
export async function previewArchiveRows(
  store: Pick<ContentArchiveStore, "findBySource" | "findByUrl">,
  sourceName: string,
  sheetName: string | undefined,
  inputs: ArchiveImportInputRow[]
): Promise<ArchiveImportPreview> {
  const seen = new Set<string>(),
    rowNumbers = new Set<number>();
  const result: ArchiveImportPreview = { sourceName, sheetName, rows: [] };
  for (const input of inputs) {
    if (rowNumbers.has(input.rowNumber))
      throw new ArchiveTaskError("ARCHIVE_IMPORT_ROWS_INVALID", "原始行号不能重复", 400);
    rowNumbers.add(input.rowNumber);
    const keyPlatform = input.inputPlatform.trim().toLowerCase();
    const selection = Object.hasOwn(platforms, keyPlatform) ? platforms[keyPlatform] : undefined;
    const link = selection === undefined ? undefined : identifyArchiveLink(input.inputUrl, selection);
    if (!link?.ok || link.url.length > 10_000) {
      result.rows.push({
        ...input,
        status: "invalid",
        progress: 0,
        message: link?.ok
          ? "链接过长，请使用原始作品链接"
          : (link?.message ?? "平台仅支持自动识别、小红书、抖音、TikTok")
      });
      continue;
    }
    const identity = archiveLinkIdentity(link.platform, link.url);
    const key = `${link.platform}:${identity ?? link.url}`;
    if (seen.has(key)) {
      result.rows.push({
        ...input,
        platform: link.platform,
        url: link.url,
        status: "duplicate",
        progress: 0,
        message: "与表格前面的作品链接重复"
      });
      continue;
    }
    seen.add(key);
    const previous = identity
      ? await store.findBySource(link.platform, identity)
      : await store.findByUrl(link.platform, link.url);
    result.rows.push({
      ...input,
      platform: link.platform,
      url: link.url,
      archiveId: previous?.id,
      status: previous ? "existing" : "ready",
      progress: 0,
      message: previous ? "作品已归档" : "可以归档"
    });
  }
  return result;
}
