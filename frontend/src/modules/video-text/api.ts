import type { AxiosProgressEvent } from "axios";
import { httpClient, withApiError } from "../../services/http";
import type {
  VideoTextHistoryParams,
  VideoTextHistoryResponse,
  VideoTextResult,
  VideoTextTaskResponse,
  VideoTextTaskStatus
} from "./types";

export const VIDEO_TEXT_REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

class VideoTextApi {
  async createTask(form: FormData, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    return withApiError(
      () =>
        httpClient.post<VideoTextTaskResponse>("/tools/video-text/tasks", form, {
          onUploadProgress,
          timeout: VIDEO_TEXT_REQUEST_TIMEOUT_MS
        }),
      "视频文本解析失败"
    );
  }

  async createTaskFromUrl(input: { url: string; fileName?: string }) {
    return withApiError(
      () =>
        httpClient.post<VideoTextTaskResponse>("/tools/video-text/tasks/from-url", input, {
          timeout: VIDEO_TEXT_REQUEST_TIMEOUT_MS
        }),
      "视频文本解析失败"
    );
  }

  async getTask(taskId: string) {
    return withApiError(
      () => httpClient.get<VideoTextTaskStatus>(`/tools/video-text/tasks/${taskId}`),
      "获取视频文本任务失败"
    );
  }

  async listHistory(params: VideoTextHistoryParams) {
    return withApiError(
      () => httpClient.get<VideoTextHistoryResponse>("/tools/video-text/history", { params }),
      "获取解析历史失败"
    );
  }

  async getHistoryResult(taskId: string) {
    return withApiError(
      () => httpClient.get<VideoTextResult>(`/tools/video-text/history/${taskId}`),
      "获取历史解析结果失败"
    );
  }

  async deleteHistory(taskId: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/video-text/history/${taskId}`),
      "删除解析历史失败"
    );
  }
}

export const videoTextApi = new VideoTextApi();
