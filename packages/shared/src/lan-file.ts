export const lanFileCategories = [
  "image",
  "video",
  "audio",
  "text",
  "pdf",
  "archive",
  "document",
  "other"
] as const;

export type LanFileCategory = (typeof lanFileCategories)[number];

export type LanFileSortBy = "createdAt" | "size" | "name" | "downloadCount";
export type LanFileSortOrder = "asc" | "desc";

export type LanFileQuery = {
  keyword: string;
  category?: LanFileCategory;
  extension: string;
  sortBy: LanFileSortBy;
  sortOrder: LanFileSortOrder;
  page: number;
  pageSize: number;
};

export type RawLanFileQuery = {
  keyword?: unknown;
  category?: unknown;
  extension?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

export type LanFileRecord = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  extension: string;
  size: number;
  category: LanFileCategory;
  createdAt: string;
  expiresAt: string;
  downloadCount: number;
  previewable: boolean;
};

const archiveExtensions = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz"]);
const documentExtensions = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv"]);
const textExtensions = new Set(["txt", "md", "json", "csv", "log", "xml", "html", "css", "js", "ts"]);

export function getLanFileExtension(fileName: string): string {
  const cleanName = fileName.split(/[\\/]/).pop() ?? fileName;
  const index = cleanName.lastIndexOf(".");
  if (index < 0 || index === cleanName.length - 1) {
    return "";
  }
  return cleanName.slice(index + 1).toLowerCase();
}

export function classifyLanFile(fileName: string, mimeType = ""): LanFileCategory {
  const normalizedMime = mimeType.toLowerCase();
  const extension = getLanFileExtension(fileName);

  if (normalizedMime.startsWith("image/")) return "image";
  if (normalizedMime.startsWith("video/")) return "video";
  if (normalizedMime.startsWith("audio/")) return "audio";
  if (normalizedMime === "application/pdf" || extension === "pdf") return "pdf";
  if (normalizedMime.startsWith("text/") || textExtensions.has(extension)) return "text";
  if (archiveExtensions.has(extension)) return "archive";
  if (documentExtensions.has(extension)) return "document";

  return "other";
}

export function isLanFilePreviewable(category: LanFileCategory): boolean {
  return category === "image" || category === "video" || category === "audio" || category === "text" || category === "pdf";
}

export function normalizeLanFileQuery(raw: RawLanFileQuery): LanFileQuery {
  const category = String(raw.category ?? "");
  const sortBy = String(raw.sortBy ?? "createdAt");
  const sortOrder = String(raw.sortOrder ?? "desc");
  const page = toPositiveInteger(raw.page, 1);
  const pageSize = toPositiveInteger(raw.pageSize, 10);

  return {
    keyword: String(raw.keyword ?? "").trim(),
    category: lanFileCategories.includes(category as LanFileCategory) ? (category as LanFileCategory) : undefined,
    extension: String(raw.extension ?? "").trim().replace(/^\./, "").toLowerCase(),
    sortBy: isLanFileSortBy(sortBy) ? sortBy : "createdAt",
    sortOrder: sortOrder === "asc" ? "asc" : "desc",
    page,
    pageSize: pageSize > 100 ? 10 : pageSize
  };
}

function isLanFileSortBy(value: string): value is LanFileSortBy {
  return value === "createdAt" || value === "size" || value === "name" || value === "downloadCount";
}

function toPositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
