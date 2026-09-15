import type { StoredVideoTextResultDto, VideoTextHistoryItemDto } from "@toolbox/shared";

export type VideoTextResult = StoredVideoTextResultDto;
export type VideoTextHistoryItem = VideoTextHistoryItemDto;

export type VideoTextHistoryParams = {
  keyword?: string;
  page?: number;
  pageSize?: number;
};
