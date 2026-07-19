import type {
  EdgeTtsCreateTaskInput,
  EdgeTtsHealth,
  EdgeTtsTask,
  EdgeTtsTaskList,
  EdgeTtsVoice
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";

export const edgeTtsApi = {
  health() {
    return withApiError(() => httpClient.get<EdgeTtsHealth>("/tools/edge-tts/health"), "无法读取语音服务状态");
  },

  voices(language?: string) {
    return withApiError(
      () =>
        httpClient.get<{ voices: EdgeTtsVoice[]; source: "live" | "fallback" }>("/tools/edge-tts/voices", {
          params: language ? { language } : undefined
        }),
      "无法读取可用音色"
    );
  },

  create(input: EdgeTtsCreateTaskInput) {
    return withApiError(
      () => httpClient.post<EdgeTtsTask>("/tools/edge-tts/tasks", input, { timeout: 30_000 }),
      "创建语音任务失败"
    );
  },

  task(taskId: string) {
    return withApiError(() => httpClient.get<EdgeTtsTask>(`/tools/edge-tts/tasks/${taskId}`), "读取语音任务失败");
  },

  list(page = 1, pageSize = 10) {
    return withApiError(
      () => httpClient.get<EdgeTtsTaskList>("/tools/edge-tts/tasks", { params: { page, pageSize } }),
      "读取语音记录失败"
    );
  },

  remove(taskId: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/edge-tts/tasks/${taskId}`),
      "删除语音任务失败"
    );
  }
};
