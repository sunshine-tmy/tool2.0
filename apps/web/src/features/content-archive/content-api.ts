/** 中性归档客户端：双平台消费同一共享契约；旧命名仅保留在小红书登录入口。 */
import {
  ContentArchiveItemSchema,
  ContentArchiveListResponseSchema,
  ContentArchiveTaskSchema,
  ContentArchivePublicationSchema,
  ContentTranslationTaskSchema,
  DouyinRuntimeStatusSchema,
  TikTokRuntimeStatusSchema,
  ArchiveImportPreviewSchema,
  ArchiveImportBatchSchema,
  ArchiveImportListSchema,
  ArchiveGroupListSchema,
  ArchiveGroupSchema,
  ArchiveGroupAssignmentResultSchema,
  type ArchiveGroupAssignment,
  type ArchiveImportCreate,
  XhsArchiveRemovalSchema,
  XhsArchiveTranslationResultSchema,
  XhsAuthSessionSchema,
  XhsRuntimeStatusSchema,
  XhsTranslationRuntimeStatusSchema,
  XhsTranslationSubmissionSchema,
  type ContentArchiveCreateInput,
  type ContentArchiveListQuery,
  type ContentTranslationBatchInput,
  type ContentTranslationEditInput,
  TikTokProfileJobSchema,
  TikTokProfileListSchema,
  TikTokProfilePageSchema,
  type TikTokProfileStart
} from "@toolbox/shared/archive";
import { httpClient, withApiError } from "../../shared/http/http";
import { resolveBackendUrl } from "../../shared/config/runtime";

const base = "/tools/media-archive";
const itemPath = (id: string) => `${base}/items/${encodeURIComponent(id)}`;
const importBase = `${base}/import`;
const profileBase = `${base}/tiktok-profiles`;
export const tiktokProfileApi = {
  list: (signal?: AbortSignal) =>
    withApiError(() => httpClient.get(profileBase, TikTokProfileListSchema, { signal }), "读取主页任务失败"),
  get: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${profileBase}/${encodeURIComponent(id)}`, TikTokProfileJobSchema, { signal }),
      "读取主页进度失败"
    ),
  works: (id: string, page: number, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.get(`${profileBase}/${encodeURIComponent(id)}/works?page=${page}`, TikTokProfilePageSchema, {
          signal
        }),
      "读取作品列表失败"
    ),
  create: (url: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post(profileBase, TikTokProfileJobSchema, { url }, { signal }),
      "读取 TikTok 主页失败"
    ),
  archive: (id: string, input: TikTokProfileStart, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.post(`${profileBase}/${encodeURIComponent(id)}/archive`, TikTokProfileJobSchema, input, { signal }),
      "启动主页归档失败"
    ),
  discover: (id: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.post(`${profileBase}/${encodeURIComponent(id)}/discover`, TikTokProfileJobSchema, undefined, {
          signal
        }),
      "继续读取主页失败"
    ),
  cancel: (id: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.post(`${profileBase}/${encodeURIComponent(id)}/cancel`, TikTokProfileJobSchema, undefined, {
          signal
        }),
      "停止主页任务失败"
    ),
  retry: (id: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.post(`${profileBase}/${encodeURIComponent(id)}/retry`, TikTokProfileJobSchema, undefined, {
          signal
        }),
      "重试主页归档失败"
    ),
  retryWork: (id: string, itemId: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.post(
          `${profileBase}/${encodeURIComponent(id)}/retry`,
          TikTokProfileJobSchema,
          { itemId },
          { signal }
        ),
      "重试该作品归档失败"
    ),
  remove: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.delete(`${profileBase}/${encodeURIComponent(id)}`, XhsArchiveRemovalSchema, { signal }),
      "删除主页任务记录失败"
    )
};
export const tiktokProfileResultsUrl = (id: string) =>
  resolveBackendUrl(`/api/v1${profileBase}/${encodeURIComponent(id)}/results.csv`);
export const archiveGroupApi = {
  list: (signal?: AbortSignal) =>
    withApiError(() => httpClient.get(`${base}/groups`, ArchiveGroupListSchema, { signal }), "读取分组失败"),
  save: (name: string, id?: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        id
          ? httpClient.patch(`${base}/groups/${encodeURIComponent(id)}`, ArchiveGroupSchema, { name }, { signal })
          : httpClient.post(`${base}/groups`, ArchiveGroupSchema, { name }, { signal }),
      "保存分组失败"
    ),
  assign: (input: ArchiveGroupAssignment, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post(`${base}/groups/assign`, ArchiveGroupAssignmentResultSchema, input, { signal }),
      "移动分组失败"
    ),
  remove: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.delete(`${base}/groups/${encodeURIComponent(id)}`, XhsArchiveRemovalSchema, { signal }),
      "删除分组失败"
    )
};
export const archiveImportApi = {
  preview: (file: File, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("file", file);
    return withApiError(
      () => httpClient.post(`${importBase}/preview`, ArchiveImportPreviewSchema, form, { signal }),
      "解析表格失败"
    );
  },
  create: (input: ArchiveImportCreate, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.post(`${importBase}/batches`, ArchiveImportBatchSchema, input, { signal }),
      "创建批量归档失败"
    ),
  list: (signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${importBase}/batches`, ArchiveImportListSchema, { signal }),
      "读取批次列表失败"
    ),
  get: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${importBase}/batches/${encodeURIComponent(id)}`, ArchiveImportBatchSchema, { signal }),
      "读取批次进度失败"
    ),
  cancel: (id: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.post(`${importBase}/batches/${encodeURIComponent(id)}/cancel`, ArchiveImportBatchSchema, undefined, {
          signal
        }),
      "停止批量归档失败"
    ),
  retry: (id: string, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.post(`${importBase}/batches/${encodeURIComponent(id)}/retry`, ArchiveImportBatchSchema, undefined, {
          signal
        }),
      "重试失败项失败"
    ),
  remove: (id: string, signal?: AbortSignal) =>
    withApiError(
      () => httpClient.delete(`${importBase}/batches/${encodeURIComponent(id)}`, XhsArchiveRemovalSchema, { signal }),
      "删除批次记录失败"
    )
};
export const archiveImportTemplateUrl = () => resolveBackendUrl("/api/v1/tools/media-archive/import/template.csv");
export const archiveImportResultUrl = (id: string) =>
  resolveBackendUrl(`/api/v1/tools/media-archive/import/batches/${encodeURIComponent(id)}/results.csv`);

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
  setPublication: (id: string, publishedElsewhere: boolean, signal?: AbortSignal) =>
    withApiError(
      () =>
        httpClient.patch(
          `${itemPath(id)}/publication`,
          ContentArchivePublicationSchema,
          { publishedElsewhere },
          { signal }
        ),
      "更新已发布标记失败"
    ),
  douyinRuntime: (signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${base}/runtime/douyin`, DouyinRuntimeStatusSchema, { signal }),
      "读取抖音环境失败"
    ),
  tiktokRuntime: (signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get(`${base}/runtime/tiktok`, TikTokRuntimeStatusSchema, { signal }),
      "读取 TikTok 获取服务失败"
    ),
  xhsRuntime: (signal?: AbortSignal) =>
    withApiError(
      () => httpClient.get("/tools/xhs-archive/runtime", XhsRuntimeStatusSchema, { signal }),
      "读取小红书环境失败"
    ),
  // 兼容登录接口限定为 XHS 平台，平台凭据不跨接口传递。
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
