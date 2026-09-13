import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { fail, type LanFileRecord, type LanNoteRecord } from "@toolbox/shared";
import type { AppConfig } from "../../config";

type LanFileReader = { get(id: string): Promise<LanFileRecord | undefined> };
type LanNoteImageReader = {
  get(id: string): Promise<LanNoteRecord | undefined>;
  imagePath(storedName: string): string;
};

export async function getFileOr404(store: LanFileReader, request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const file = await store.get(id);
  if (!file) {
    reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
    return undefined;
  }
  return file;
}

export async function sendFile(
  reply: FastifyReply,
  config: AppConfig,
  file: LanFileRecord,
  disposition: "inline" | "attachment",
  rangeHeader?: string
) {
  const filePath = path.join(config.lanTransferFilesDir, file.storedName);
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    return reply.code(404).send(fail("LAN_FILE_MISSING", "文件元数据存在，但磁盘文件已丢失"));
  }
  const encodedName = encodeURIComponent(file.originalName);
  reply.header("accept-ranges", "bytes");
  reply.header("x-content-type-options", "nosniff");
  if (disposition === "inline") {
    reply.header("content-security-policy", "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'");
  }
  reply.header("content-type", safeResponseContentType(file, disposition));
  reply.header(
    "content-disposition",
    `${disposition}; filename*=UTF-8''${encodedName}; filename="${fallbackFileName(file.originalName)}"`
  );

  if (rangeHeader) {
    const range = parseRange(rangeHeader, stat.size);
    if (!range) {
      return reply.code(416).send(fail("INVALID_RANGE", "Invalid range request"));
    }

    reply.code(206);
    reply.header("content-range", `bytes ${range.start}-${range.end}/${stat.size}`);
    reply.header("content-length", String(range.end - range.start + 1));
    return reply.send(fs.createReadStream(filePath, { start: range.start, end: range.end }));
  }

  reply.header("content-length", String(stat.size));
  return reply.send(fs.createReadStream(filePath));
}

export async function hasPdfSignature(filePath: string) {
  const handle = await fsp.open(filePath, "r");
  try {
    const header = Buffer.alloc(5);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return bytesRead === header.length && header.toString("ascii") === "%PDF-";
  } finally {
    await handle.close();
  }
}

const lanNoteImageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif"
};

export function isAllowedLanNoteImageMime(mimeType: string) {
  return mimeType in lanNoteImageExtensions;
}

export function extensionForLanNoteImage(mimeType: string) {
  return lanNoteImageExtensions[mimeType] ?? "img";
}

export async function hasLanNoteImageSignature(filePath: string, mimeType: string) {
  const handle = await fsp.open(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const value = header.subarray(0, bytesRead);
    if (mimeType === "image/jpeg") {
      return value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff;
    }
    if (mimeType === "image/png") {
      return (
        value.length >= 8 && value.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );
    }
    if (mimeType === "image/gif") {
      const signature = value.subarray(0, 6).toString("ascii");
      return signature === "GIF87a" || signature === "GIF89a";
    }
    if (mimeType === "image/webp") {
      return (
        value.length >= 12 &&
        value.subarray(0, 4).toString("ascii") === "RIFF" &&
        value.subarray(8, 12).toString("ascii") === "WEBP"
      );
    }
    if (mimeType === "image/avif") {
      const brand = value.subarray(8, 12).toString("ascii");
      return (
        value.length >= 12 &&
        value.subarray(4, 8).toString("ascii") === "ftyp" &&
        (brand === "avif" || brand === "avis")
      );
    }
    return false;
  } finally {
    await handle.close();
  }
}

export function withUrls(file: LanFileRecord, basePath: string) {
  return {
    ...file,
    previewUrl: `${basePath}/files/${file.id}/preview`,
    downloadUrl: `${basePath}/files/${file.id}/download`
  };
}

export function withNoteUrls(note: LanNoteRecord, basePath: string) {
  return {
    ...note,
    images: note.images.map((image) => ({
      ...image,
      previewUrl: `${basePath}/notes/${note.id}/images/${image.id}/preview`,
      downloadUrl: `${basePath}/notes/${note.id}/images/${image.id}/download`
    }))
  };
}

export async function sendLanNoteImage(
  noteStore: LanNoteImageReader,
  request: FastifyRequest,
  reply: FastifyReply,
  disposition: "inline" | "attachment"
) {
  const { id, imageId } = request.params as { id: string; imageId: string };
  const note = await noteStore.get(id);
  const image = note?.images.find((item) => item.id === imageId);
  if (!note || !image) {
    return reply.code(404).send(fail("LAN_NOTE_IMAGE_NOT_FOUND", "图片不存在或已过期"));
  }
  const imagePath = noteStore.imagePath(image.storedName);
  let stat;
  try {
    stat = await fsp.stat(imagePath);
  } catch {
    return reply.code(404).send(fail("LAN_NOTE_IMAGE_MISSING", "图片元数据存在，但磁盘文件已丢失"));
  }
  reply.header("x-content-type-options", "nosniff");
  reply.header("content-type", image.mimeType);
  reply.header("content-length", String(stat.size));
  if (disposition === "inline") {
    reply.header("content-security-policy", "sandbox; default-src 'none'; img-src 'self' data:");
  }
  reply.header(
    "content-disposition",
    `${disposition}; filename*=UTF-8''${encodeURIComponent(image.originalName)}; filename="${fallbackFileName(image.originalName)}"`
  );
  return reply.send(fs.createReadStream(imagePath));
}

function safeResponseContentType(file: LanFileRecord, disposition: "inline" | "attachment") {
  if (disposition === "attachment") return file.mimeType || "application/octet-stream";
  if (file.category === "pdf") return "application/pdf";
  if (file.category === "text") return "text/plain; charset=utf-8";
  if (file.category === "image" && file.mimeType.startsWith("image/")) return file.mimeType;
  if (file.category === "video" && file.mimeType.startsWith("video/")) return file.mimeType;
  if (file.category === "audio" && file.mimeType.startsWith("audio/")) return file.mimeType;
  return "application/octet-stream";
}

function parseRange(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match || (!match[1] && !match[2])) return undefined;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return undefined;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return undefined;
  return { start, end: Math.min(end, size - 1) };
}

function fallbackFileName(fileName: string) {
  return fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_");
}
