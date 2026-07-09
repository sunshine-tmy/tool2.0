import type { VideoTextAnalysis } from "@toolbox/shared/video-text";
import type { ToolTask } from "../../types";

export type VideoTextTaskResponse = {
  task: ToolTask;
  result: VideoTextResult | null;
};

export type VideoTextTaskStatus = {
  task: ToolTask;
  result: VideoTextResult | null;
};

export type VideoTextResult = VideoTextAnalysis & {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  source: "form-text" | "transcriber";
  createdAt: string;
};

export type VideoTextHistoryItem = Pick<
  VideoTextResult,
  "id" | "fileName" | "fileSize" | "mimeType" | "source" | "createdAt"
> & {
  summary: string[];
  textPreview: string;
  characterCount: number;
};

export type VideoTextHistoryParams = {
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export type VideoTextHistoryResponse = {
  items: VideoTextHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};
