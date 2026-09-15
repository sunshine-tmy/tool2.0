/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
export type LanNoteImageRecord = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  extension: string;
  size: number;
};

export type LanNoteRecord = {
  id: string;
  title?: string;
  content: string;
  images: LanNoteImageRecord[];
  createdAt: string;
  expiresAt: string;
};

export const lanNoteLimits = {
  titleCharacters: 100,
  contentCharacters: 20_000,
  maxImages: 6,
  maxImageBytes: 10 * 1024 * 1024,
  maxTotalImageBytes: 30 * 1024 * 1024
} as const;
