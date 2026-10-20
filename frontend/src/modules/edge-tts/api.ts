/**
 * 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互
 */
import {
  EdgeTtsCreateTaskInput,
  EdgeTtsHealthSchema,
  EdgeTtsRemovalSchema,
  EdgeTtsTaskListSchema,
  EdgeTtsTaskSchema,
  EdgeTtsVoicesSchema
} from "@toolbox/shared";
import {
  EdgeTtsBatchSchema,
  EdgeTtsBatchListSchema,
  type EdgeTtsBatchCreate,
  type EdgeTtsBatchRegenerate
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";

export const edgeTtsApi = {
  createBatch(input: EdgeTtsBatchCreate) {
    return withApiError(() =>
      httpClient.post("/tools/edge-tts/batches", EdgeTtsBatchSchema, input, { timeout: 30_000 })
    );
  },
  batches(page = 1, pageSize = 10) {
    return withApiError(() =>
      httpClient.get("/tools/edge-tts/batches", EdgeTtsBatchListSchema, { params: { page, pageSize } })
    );
  },
  batch(id: string) {
    return withApiError(() => httpClient.get(`/tools/edge-tts/batches/${id}`, EdgeTtsBatchSchema));
  },
  cancelBatch(id: string) {
    return withApiError(() => httpClient.post(`/tools/edge-tts/batches/${id}/cancel`, EdgeTtsBatchSchema));
  },
  removeBatch(id: string) {
    return withApiError(() => httpClient.delete(`/tools/edge-tts/batches/${id}`, EdgeTtsRemovalSchema));
  },
  regenerate(id: string, itemId: string, input: EdgeTtsBatchRegenerate) {
    return withApiError(() =>
      httpClient.post(`/tools/edge-tts/batches/${id}/items/${itemId}/regenerate`, EdgeTtsBatchSchema, input)
    );
  },
  reorder(id: string, itemIds: string[]) {
    return withApiError(() => httpClient.patch(`/tools/edge-tts/batches/${id}/order`, EdgeTtsBatchSchema, { itemIds }));
  },
  removeBatchItem(id: string, itemId: string) {
    return withApiError(() => httpClient.delete(`/tools/edge-tts/batches/${id}/items/${itemId}`, EdgeTtsBatchSchema));
  },
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
