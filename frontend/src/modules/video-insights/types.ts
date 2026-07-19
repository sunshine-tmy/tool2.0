import type { ModelProviderConfig, VideoInsight, VideoInsightPatchInput } from "@toolbox/shared";

export type VideoInsightListParams = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  platform?: "all" | "douyin" | "xiaohongshu" | "tiktok" | "unknown";
  tag?: string;
  favorite?: boolean;
  archived?: boolean;
  sort?: "newest" | "oldest" | "updated";
};

export type VideoInsightListResult = {
  items: VideoInsight[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  model: ModelProviderConfig;
};

export type VideoInsightPatch = VideoInsightPatchInput;
