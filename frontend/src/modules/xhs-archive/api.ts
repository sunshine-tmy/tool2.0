/**
 * 中文模块说明：小红书归档前端模块，负责列表、详情、媒体和翻译交互
 */
import {
  XhsArchiveItemSchema,
  XhsArchiveListResponseSchema,
  XhsArchiveRemovalSchema,
  XhsArchiveTaskSchema,
  XhsArchiveTranslationResultSchema,
  XhsAuthSessionSchema,
  XhsRuntimeStatusSchema,
  XhsTranslationRuntimeStatusSchema,
  XhsTranslationSubmissionSchema,
  XhsTranslationTaskSchema
} from "@toolbox/shared";
import type { XhsArchiveItem } from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";

const base = "/tools/xhs-archive";

export const xhsArchiveApi = {
  runtime: () => withApiError(() => httpClient.get(`${base}/runtime`, XhsRuntimeStatusSchema), "读取解析环境失败"),
  create: (url: string) =>
    withApiError(() => httpClient.post(`${base}/items`, XhsArchiveTaskSchema, { url }), "创建获取任务失败"),
  task: (id: string) =>
    withApiError(() => httpClient.get(`${base}/tasks/${id}`, XhsArchiveTaskSchema), "读取任务进度失败"),
  list: (params: { keyword?: string; type?: string; page?: number; pageSize?: number }) =>
    withApiError(() => httpClient.get(`${base}/items`, XhsArchiveListResponseSchema, { params }), "读取内容存档失败"),
  detail: (id: string) =>
    withApiError(() => httpClient.get(`${base}/items/${id}`, XhsArchiveItemSchema), "读取存档详情失败"),
  addFrame: (id: string, form: FormData) =>
    withApiError(
      () => httpClient.post(`${base}/items/${id}/frames`, XhsArchiveItemSchema, form),
      "保存视频截帧失败"
    ) as Promise<XhsArchiveItem>,
  refresh: (id: string) =>
    withApiError(() => httpClient.post(`${base}/items/${id}/refresh`, XhsArchiveTaskSchema), "创建刷新任务失败"),
  remove: (id: string) =>
    withApiError(() => httpClient.delete(`${base}/items/${id}`, XhsArchiveRemovalSchema), "删除存档失败"),
  startAuth: () => withApiError(() => httpClient.post(`${base}/auth/start`, XhsAuthSessionSchema), "启动登录窗口失败"),
  auth: (id: string) =>
    withApiError(() => httpClient.get(`${base}/auth/${id}`, XhsAuthSessionSchema), "读取登录状态失败"),
  translationRuntime: () =>
    withApiError(
      () => httpClient.get(`${base}/translation/runtime`, XhsTranslationRuntimeStatusSchema),
      "读取翻译环境失败"
    ),
  translate: (id: string, force = false) =>
    withApiError(
      () => httpClient.post(`${base}/items/${id}/translation`, XhsTranslationSubmissionSchema, { force }),
      "创建翻译任务失败"
    ),
  translationTask: (id: string) =>
    withApiError(() => httpClient.get(`${base}/translation/tasks/${id}`, XhsTranslationTaskSchema), "读取翻译进度失败"),
  translateBatch: (payload: { mode: "selected" | "missing-or-stale"; itemIds?: string[] }) =>
    withApiError(
      () => httpClient.post(`${base}/translation/batches`, XhsTranslationSubmissionSchema, payload),
      "创建批量翻译任务失败"
    ),
  editTranslation: (
    id: string,
    payload: {
      sourceHash: string;
      title: { edited: string };
      description?: { edited: string };
      topics: Array<{ topicId: string; edited: string }>;
    }
  ) =>
    withApiError(
      () => httpClient.patch(`${base}/items/${id}/translation`, XhsArchiveTranslationResultSchema, payload),
      "保存英文修订失败"
    ),
  resetTranslation: (id: string) =>
    withApiError(
      () => httpClient.post(`${base}/items/${id}/translation/reset`, XhsArchiveTranslationResultSchema),
      "恢复机器翻译失败"
    )
};
