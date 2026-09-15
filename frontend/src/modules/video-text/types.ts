/**
 * 中文模块说明：视频文本前端模块，负责来源、进度、结果、历史和导出
 */
import type { StoredVideoTextResultDto, VideoTextHistoryItemDto } from "@toolbox/shared";

export type VideoTextResult = StoredVideoTextResultDto;
export type VideoTextHistoryItem = VideoTextHistoryItemDto;

export type VideoTextHistoryParams = {
  keyword?: string;
  page?: number;
  pageSize?: number;
};
