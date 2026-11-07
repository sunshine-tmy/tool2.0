/**
 * 中文模块说明：视频去字幕前端模块，负责选择视频、框选字幕、任务进度和结果下载
 */
import {
  VideoAiDeleteSchema,
  VideoAiDetectionSchema,
  VideoAiHealthSchema,
  VideoAiHistorySchema,
  VideoAiTaskSchema,
  type VideoAiMode,
  type VideoAiRect,
  type VideoAiTimedRegion,
  type VideoAiSegment,
  type VideoAiHistoryQuery
} from "@toolbox/shared";
import { resolveApiUrl } from "../../shared/config/runtime";
import { httpClient, withApiError } from "../../shared/http/http";

class VideoAiApi {
  async health(signal?: AbortSignal) {
    return withApiError(
      () => httpClient.get("/tools/video-ai/health", VideoAiHealthSchema, { signal }),
      "无法读取视频处理能力状态"
    );
  }

  async detect(file: File, signal?: AbortSignal) {
    const form = new FormData();
    form.append("video", file, file.name);
    return withApiError(
      () => httpClient.post("/tools/video-ai/detect", VideoAiDetectionSchema, form, { timeout: 1_800_000, signal }),
      "字幕区域检测失败"
    );
  }

  async create(
    input: {
      file: File;
      mode: VideoAiMode;
      manualArea?: VideoAiRect;
      segments?: VideoAiSegment[];
      manualRanges?: VideoAiTimedRegion[];
    },
    signal?: AbortSignal
  ) {
    const form = new FormData();
    form.append("video", input.file, input.file.name);
    form.append("mode", input.mode);
    if (input.manualArea) form.append("manualArea", JSON.stringify(input.manualArea));
    if (input.segments?.length) form.append("segments", JSON.stringify(input.segments));
    if (input.manualRanges?.length) form.append("manualRanges", JSON.stringify(input.manualRanges));
    return withApiError(
      () => httpClient.post("/tools/video-ai/tasks", VideoAiTaskSchema, form, { timeout: 220_000, signal }),
      "提交视频去字幕任务失败"
    );
  }

  async get(taskId: string, signal?: AbortSignal) {
    return withApiError(
      () => httpClient.get(`/tools/video-ai/tasks/${encodeURIComponent(taskId)}`, VideoAiTaskSchema, { signal }),
      "读取任务状态失败"
    );
  }

  async cancel(taskId: string) {
    return withApiError(
      () => httpClient.post(`/tools/video-ai/tasks/${encodeURIComponent(taskId)}/cancel`, VideoAiTaskSchema, {}),
      "取消任务失败"
    );
  }

  async remove(taskId: string) {
    return withApiError(
      () => httpClient.delete(`/tools/video-ai/tasks/${encodeURIComponent(taskId)}`, VideoAiDeleteSchema),
      "删除任务失败"
    );
  }

  async history(query: VideoAiHistoryQuery = {}, signal?: AbortSignal) {
    return withApiError(
      () => httpClient.get("/tools/video-ai/history", VideoAiHistorySchema, { params: query, signal }),
      "读取处理记录失败"
    );
  }

  outputUrl(taskId: string) {
    return resolveApiUrl(`/tools/video-ai/tasks/${encodeURIComponent(taskId)}/output`);
  }
}

export const videoAiApi = new VideoAiApi();
