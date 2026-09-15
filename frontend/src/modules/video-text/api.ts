import type { AxiosProgressEvent } from "axios";
import {
  StoredVideoTextResultSchema,
  VideoTextHistorySchema,
  VideoTextRemovalSchema,
  VideoTextTaskResponseSchema
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";
import type { VideoTextHistoryParams } from "./types";

export const VIDEO_TEXT_REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

class VideoTextApi {
  async createTask(form: FormData, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    return withApiError(
      () =>
        httpClient.post("/tools/video-text/tasks", VideoTextTaskResponseSchema, form, {
          onUploadProgress,
          timeout: VIDEO_TEXT_REQUEST_TIMEOUT_MS
        }),
      "视频文本解析失败"
    );
  }

  async createTaskFromUrl(input: { url: string; fileName?: string }) {
    return withApiError(
      () =>
        httpClient.post("/tools/video-text/tasks/from-url", VideoTextTaskResponseSchema, input, {
          timeout: VIDEO_TEXT_REQUEST_TIMEOUT_MS
        }),
      "视频文本解析失败"
    );
  }

  async getTask(taskId: string) {
    return withApiError(
      () => httpClient.get(`/tools/video-text/tasks/${taskId}`, VideoTextTaskResponseSchema),
      "获取视频文本任务失败"
    );
  }

  async listHistory(params: VideoTextHistoryParams) {
    return withApiError(
      () => httpClient.get("/tools/video-text/history", VideoTextHistorySchema, { params }),
      "获取解析历史失败"
    );
  }

  async getHistoryResult(taskId: string) {
    return withApiError(
      () => httpClient.get(`/tools/video-text/history/${taskId}`, StoredVideoTextResultSchema),
      "获取历史解析结果失败"
    );
  }

  async deleteHistory(taskId: string) {
    return withApiError(
      () => httpClient.delete(`/tools/video-text/history/${taskId}`, VideoTextRemovalSchema),
      "删除解析历史失败"
    );
  }
}

export const videoTextApi = new VideoTextApi();
