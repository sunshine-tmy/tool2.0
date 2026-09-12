import type {
  XhsArchiveItem,
  XhsArchiveListResponse,
  XhsArchiveTask,
  XhsAuthSession,
  XhsRuntimeStatus,
  XhsTranslationRuntimeStatus,
  XhsTranslationTask
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";

const base = "/tools/xhs-archive";

export const xhsArchiveApi = {
  runtime: () => withApiError(() => httpClient.get<XhsRuntimeStatus>(`${base}/runtime`), "读取解析环境失败"),
  create: (url: string) =>
    withApiError(() => httpClient.post<XhsArchiveTask>(`${base}/items`, { url }), "创建获取任务失败"),
  task: (id: string) => withApiError(() => httpClient.get<XhsArchiveTask>(`${base}/tasks/${id}`), "读取任务进度失败"),
  list: (params: { keyword?: string; type?: string; page?: number; pageSize?: number }) =>
    withApiError(() => httpClient.get<XhsArchiveListResponse>(`${base}/items`, { params }), "读取内容存档失败"),
  detail: (id: string) => withApiError(() => httpClient.get<XhsArchiveItem>(`${base}/items/${id}`), "读取存档详情失败"),
  refresh: (id: string) =>
    withApiError(() => httpClient.post<XhsArchiveTask>(`${base}/items/${id}/refresh`), "创建刷新任务失败"),
  remove: (id: string) =>
    withApiError(
      () => httpClient.delete<{ removed: boolean; mediaCount: number; releasedBytes: number }>(`${base}/items/${id}`),
      "删除存档失败"
    ),
  startAuth: () => withApiError(() => httpClient.post<XhsAuthSession>(`${base}/auth/start`), "启动登录窗口失败"),
  auth: (id: string) => withApiError(() => httpClient.get<XhsAuthSession>(`${base}/auth/${id}`), "读取登录状态失败"),
  translationRuntime: () =>
    withApiError(() => httpClient.get<XhsTranslationRuntimeStatus>(`${base}/translation/runtime`), "读取翻译环境失败"),
  translate: (id: string, force = false) =>
    withApiError(
      () => httpClient.post<XhsTranslationTask>(`${base}/items/${id}/translation`, { force }),
      "创建翻译任务失败"
    ),
  translationTask: (id: string) =>
    withApiError(() => httpClient.get<XhsTranslationTask>(`${base}/translation/tasks/${id}`), "读取翻译进度失败"),
  translateBatch: (payload: { mode: "selected" | "missing-or-stale"; itemIds?: string[] }) =>
    withApiError(
      () => httpClient.post<XhsTranslationTask>(`${base}/translation/batches`, payload),
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
  ) => withApiError(() => httpClient.patch(`${base}/items/${id}/translation`, payload), "保存英文修订失败"),
  resetTranslation: (id: string) =>
    withApiError(() => httpClient.post(`${base}/items/${id}/translation/reset`), "恢复机器翻译失败")
};
