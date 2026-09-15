import {
  EdgeTtsCreateTaskInput,
  EdgeTtsHealthSchema,
  EdgeTtsRemovalSchema,
  EdgeTtsTaskListSchema,
  EdgeTtsTaskSchema,
  EdgeTtsVoicesSchema
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";

export const edgeTtsApi = {
  health() {
    return withApiError(() => httpClient.get("/tools/edge-tts/health", EdgeTtsHealthSchema), "无法读取语音服务状态");
  },

  voices(language?: string) {
    return withApiError(
      () =>
        httpClient.get("/tools/edge-tts/voices", EdgeTtsVoicesSchema, {
          params: language ? { language } : undefined
        }),
      "无法读取可用音色"
    );
  },

  create(input: EdgeTtsCreateTaskInput) {
    return withApiError(
      () => httpClient.post("/tools/edge-tts/tasks", EdgeTtsTaskSchema, input, { timeout: 30_000 }),
      "创建语音任务失败"
    );
  },

  task(taskId: string) {
    return withApiError(() => httpClient.get(`/tools/edge-tts/tasks/${taskId}`, EdgeTtsTaskSchema), "读取语音任务失败");
  },

  list(page = 1, pageSize = 10) {
    return withApiError(
      () => httpClient.get("/tools/edge-tts/tasks", EdgeTtsTaskListSchema, { params: { page, pageSize } }),
      "读取语音记录失败"
    );
  },

  remove(taskId: string) {
    return withApiError(
      () => httpClient.delete(`/tools/edge-tts/tasks/${taskId}`, EdgeTtsRemovalSchema),
      "删除语音任务失败"
    );
  }
};
