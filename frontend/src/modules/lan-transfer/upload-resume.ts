/**
 * 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理
 */
import type { PendingLanUpload } from "./types";

const STORAGE_KEY = "toolbox:lan-transfer:pending-uploads:v1";

export function fileFingerprint(file: File) {
  return [file.name, file.size, file.lastModified, file.type || "application/octet-stream"].join(":");
}

export function listPendingUploads(): PendingLanUpload[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(isPendingUpload).slice(0, 50);
  } catch {
    return [];
  }
}

export function findPendingUpload(file: File) {
  const fingerprint = fileFingerprint(file);
  return listPendingUploads().find((item) => item.fingerprint === fingerprint);
}

export function savePendingUpload(file: File, uploadId: string) {
  const fingerprint = fileFingerprint(file);
  const next: PendingLanUpload = {
    uploadId,
    fingerprint,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    lastModified: file.lastModified,
    updatedAt: new Date().toISOString()
  };
  const items = listPendingUploads().filter((item) => item.fingerprint !== fingerprint && item.uploadId !== uploadId);
  writePendingUploads([next, ...items].slice(0, 50));
  return next;
}

export function removePendingUpload(uploadId: string) {
  writePendingUploads(listPendingUploads().filter((item) => item.uploadId !== uploadId));
}

export function clearPendingUploads() {
  writePendingUploads([]);
}

function writePendingUploads(items: PendingLanUpload[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function isPendingUpload(value: unknown): value is PendingLanUpload {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PendingLanUpload>;
  return (
    typeof item.uploadId === "string" &&
    typeof item.fingerprint === "string" &&
    typeof item.originalName === "string" &&
    typeof item.mimeType === "string" &&
    typeof item.size === "number" &&
    typeof item.lastModified === "number" &&
    typeof item.updatedAt === "string"
  );
}
