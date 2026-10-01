/** 中性归档客户端：双平台消费同一共享契约；旧命名仅保留在小红书登录入口。 */
import {
  ContentArchiveItemSchema,
  ContentArchiveListResponseSchema,
  ContentArchiveTaskSchema,
  ContentTranslationTaskSchema,
  DouyinRuntimeStatusSchema,
  XhsArchiveRemovalSchema,
  XhsArchiveTranslationResultSchema,
  XhsAuthSessionSchema,
  XhsRuntimeStatusSchema,
  XhsTranslationRuntimeStatusSchema,
  XhsTranslationSubmissionSchema,
  type ContentArchiveCreateInput,
  type ContentArchiveListQuery,
  type ContentTranslationBatchInput,
  type ContentTranslationEditInput
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";
import { resolveBackendUrl } from "../../config/runtime";

const base = "/tools/media-archive";
const itemPath = (id: string) => `${base}/items/${encodeURIComponent(id)}`;

// 每个请求显式传递 signal，让页面/弹窗卸载能中止真实传输，而不只是忽略返回值。
export const contentArchiveApi = {
  create: (payload: ContentArchiveCreateInput, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post(`${base}/items`, ContentArchiveTaskSchema, payload, { signal }),
      "创建获取任务失败"
    ),
  task: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${base}/tasks/${encodeURIComponent(id)}`, ContentArchiveTaskSchema, { signal }),
      "读取任务进度失败"
    ),
  cancel: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.delete(`${base}/tasks/${encodeURIComponent(id)}`, ContentArchiveTaskSchema, { signal }),
      "取消获取任务失败"
    ),
  list: (params: ContentArchiveListQuery, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${base}/items`, ContentArchiveListResponseSchema, { params, signal }),
      "读取内容存档失败"
    ),
  detail: (id: string, signal?: AbortSignal) =>
    withApiError(() => httpClient.get(itemPath(id), ContentArchiveItemSchema, { signal }), "读取存档详情失败"),
  addFrame: (id: string, form: FormData, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post(`${itemPath(id)}/frames`, ContentArchiveItemSchema, form, { signal }),
      "保存视频截帧失败"
    ),
  refresh: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post(`${itemPath(id)}/refresh`, ContentArchiveTaskSchema, undefined, { signal }),
      "创建刷新任务失败"
    ),
  remove: (id: string, signal?: AbortSignal) =>
    withApiError(() => httpClient.delete(itemPath(id), XhsArchiveRemovalSchema, { signal }), "删除存档失败"),
  douyinRuntime: (signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${base}/runtime/douyin`, DouyinRuntimeStatusSchema, { signal }),
      "读取抖音环境失败"
    ),
  xhsRuntime: (signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get("/tools/xhs-archive/runtime", XhsRuntimeStatusSchema, { signal }),
      "读取小红书环境失败"
    ),
  // 本期跳过抖音登录；这里明确只有 XHS 登录，禁止平台凭据混用。
  startXhsAuth: (signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post("/tools/xhs-archive/auth/start", XhsAuthSessionSchema, undefined, { signal }),
      "启动登录窗口失败"
    ),
  xhsAuth: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`/tools/xhs-archive/auth/${encodeURIComponent(id)}`, XhsAuthSessionSchema, { signal }),
      "读取登录状态失败"
    ),
  translationRuntime: (signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${base}/translation/runtime`, XhsTranslationRuntimeStatusSchema, { signal }),
      "读取翻译环境失败"
    ),
  translate: (id: string, force = false, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post(`${itemPath(id)}/translation`, XhsTranslationSubmissionSchema, { force }, { signal }),
      "创建翻译任务失败"
    ),
  translationTask: (id: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.get(`${base}/translation/tasks/${encodeURIComponent(id)}`, ContentTranslationTaskSchema, { signal }),
      "读取翻译进度失败"
    ),
  translateBatch: (payload: ContentTranslationBatchInput, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post(`${base}/translation/batches`, XhsTranslationSubmissionSchema, payload, { signal }),
      "创建批量翻译任务失败"
    ),
  editTranslation: (id: string, payload: ContentTranslationEditInput, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.patch(`${itemPath(id)}/translation`, XhsArchiveTranslationResultSchema, payload, { signal }),
      "保存英文修订失败"
    ),
  resetTranslation: (id: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.post(`${itemPath(id)}/translation/reset`, XhsArchiveTranslationResultSchema, undefined, { signal }),
      "恢复机器翻译失败"
    )
};

/** 导出 URL 与业务请求使用同一中性入口，既有本地媒体 URL 仍由服务端提供。 */
export function contentArchiveZipUrl(id: string) {
  return resolveBackendUrl(`/api/v1${itemPath(id)}/download.zip`);
}
