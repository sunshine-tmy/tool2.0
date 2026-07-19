import type { ShortVideoPlatform, VideoInsight } from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";
import type { VideoInsightListParams, VideoInsightListResult, VideoInsightPatch } from "./types";

class VideoInsightsApi {
  create(input: string, platform: Exclude<ShortVideoPlatform, "unknown"> = "auto") {
    return withApiError(
      () => httpClient.post<VideoInsight>("/tools/video-insights", { input, platform }),
      "创建竞品卡片失败"
    );
  }

  upload(file: File) {
    const form = new FormData();
    form.append("file", file, file.name);
    return withApiError(
      () =>
        httpClient.post<VideoInsight>("/tools/video-insights/upload", form, {
          timeout: 30 * 60 * 1000
        }),
      "上传视频分析失败"
    );
  }

  list(params: VideoInsightListParams) {
    return withApiError(
      () => httpClient.get<VideoInsightListResult>("/tools/video-insights", { params }),
      "加载竞品卡片失败"
    );
  }

  get(id: string) {
    return withApiError(() => httpClient.get<VideoInsight>(`/tools/video-insights/${id}`), "加载竞品详情失败");
  }

  update(id: string, patch: VideoInsightPatch) {
    return withApiError(() => httpClient.patch<VideoInsight>(`/tools/video-insights/${id}`, patch), "保存竞品卡片失败");
  }

  remove(id: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/video-insights/${id}`),
      "删除竞品卡片失败"
    );
  }

  analyze(id: string, mode: "rules" | "model") {
    return withApiError(
      () => httpClient.post<VideoInsight>(`/tools/video-insights/${id}/analyze`, { mode }),
      "重新拆解失败"
    );
  }
}

export const videoInsightsApi = new VideoInsightsApi();
