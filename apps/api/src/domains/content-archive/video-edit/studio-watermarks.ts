import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ArchiveStudio, ArchiveVideoEdit } from "@toolbox/shared";
import type { ArchiveWatermarkDrafts } from "./watermark-drafts";
import { VideoEditError } from "./renderer";
type Lease = Awaited<ReturnType<ArchiveWatermarkDrafts["acquire"]>>;
export async function snapshotStudioWatermarks(options: {
  studio: ArchiveStudio;
  previous?: ArchiveVideoEdit;
  directory: string;
  previousDirectory: string;
  leases: Map<string, Lease>;
  reserve: (file: string) => Promise<void>;
  addedFiles: string[];
}) {
  const assets: NonNullable<ArchiveVideoEdit["studioWatermarks"]> = [];
  const files: Record<string, { file: string; width: number; height: number }> = Object.create(null);
  for (const mark of options.studio.watermarks ?? []) {
    if (files[mark.asset.id]) {
      const saved = assets.find((asset) => asset.assetId === mark.asset.id)!;
      mark.asset = {
        id: mark.asset.id,
        kind: "saved",
        width: saved.width,
        height: saved.height,
        checksum: saved.file.checksum
      };
      continue;
    }
    const old = options.previous?.studioWatermarks?.find((asset) => asset.assetId === mark.asset.id);
    const legacy = mark.asset.id === "legacy_watermark" ? options.previous?.watermark : undefined;
    const draft = mark.asset.kind === "draft" ? options.leases.get(mark.asset.id) : undefined;
    const source = old ?? legacy ?? draft;
    if (!source) throw new VideoEditError("ARCHIVE_WATERMARK_MISSING", "水印素材不存在或草稿已过期，请重新选择", 404);
    const name = source.file.fileName;
    if (path.basename(name) !== name || name.includes("\\") || name.includes("/"))
      throw new VideoEditError("ARCHIVE_WATERMARK_INVALID", "水印快照文件名无效", 400);
    const input = draft?.path ?? path.join(options.previousDirectory, name);
    await options.reserve(input);
    await fs.copyFile(input, path.join(options.directory, name));
    const bytes = await fs.readFile(path.join(options.directory, name));
    if (bytes.length !== source.file.size || createHash("sha256").update(bytes).digest("hex") !== source.file.checksum)
      throw new VideoEditError("ARCHIVE_WATERMARK_CHANGED", "水印素材已发生变化，请重新选择", 409);
    assets.push({
      assetId: mark.asset.id,
      file: structuredClone(source.file),
      width: source.width,
      height: source.height
    });
    files[mark.asset.id] = { file: path.join(options.directory, name), width: source.width, height: source.height };
    if (draft) options.addedFiles.push(name);
    mark.asset = {
      id: mark.asset.id,
      kind: "saved",
      width: source.width,
      height: source.height,
      checksum: source.file.checksum
    };
  }
  return { assets, files };
}
