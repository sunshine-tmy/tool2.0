/** 中性客户端的路径、契约、编码和取消传播；XHS 登录不能迁移到抖音或携带 Cookie。 */
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  XhsTranslationSubmissionSchema
} from "@toolbox/shared";
import { contentArchiveApi as api, contentArchiveZipUrl } from "./content-api";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: http
}));
beforeEach(() => {
  vi.clearAllMocks();
  Object.values(http).forEach((method) => method.mockResolvedValue({}));
});

describe("多媒体归档客户端", () => {
  it("所有 JSON 操作传入共享响应 Schema 和同一 AbortSignal", async () => {
    const signal = new AbortController().signal;
    const params = { platform: "douyin" as const, keyword: "晚霞", type: "video" as const, page: 2, pageSize: 12 };
    const create = { url: "https://v.douyin.com/example/", platform: "douyin" as const };
    const form = new FormData();
    form.append("sourceMediaId", "video-123");
    const batch = { mode: "missing-or-stale" as const, filter: { platform: "douyin" as const, keyword: "晚霞" } };
    const edit = { sourceHash: "a".repeat(64), title: { edited: "Sunset" }, topics: [] };
    await api.create(create, signal);
    await api.task("task/1", signal);
    await api.cancel("task/1", signal);
    await api.list(params, signal);
    await api.detail("item/1", signal);
    await api.addFrame("item/1", form, signal);
    await api.refresh("item/1", signal);
    await api.remove("item/1", signal);
    await api.douyinRuntime(signal);
    await api.xhsRuntime(signal);
    await api.startXhsAuth(signal);
    await api.xhsAuth("auth/1", signal);
    await api.translationRuntime(signal);
    await api.translate("item/1", true, signal);
    await api.translationTask("tr/1", signal);
    await api.translateBatch(batch, signal);
    await api.editTranslation("item/1", edit, signal);
    await api.resetTranslation("item/1", signal);
    expect(http.get.mock.calls).toEqual([
      ["/tools/media-archive/tasks/task%2F1", ContentArchiveTaskSchema, { signal }],
      ["/tools/media-archive/items", ContentArchiveListResponseSchema, { params, signal }],
      ["/tools/media-archive/items/item%2F1", ContentArchiveItemSchema, { signal }],
      ["/tools/media-archive/runtime/douyin", DouyinRuntimeStatusSchema, { signal }],
      ["/tools/xhs-archive/runtime", XhsRuntimeStatusSchema, { signal }],
      ["/tools/xhs-archive/auth/auth%2F1", XhsAuthSessionSchema, { signal }],
      ["/tools/media-archive/translation/runtime", XhsTranslationRuntimeStatusSchema, { signal }],
      ["/tools/media-archive/translation/tasks/tr%2F1", ContentTranslationTaskSchema, { signal }]
    ]);
    expect(http.post.mock.calls).toEqual([
      ["/tools/media-archive/items", ContentArchiveTaskSchema, create, { signal }],
      ["/tools/media-archive/items/item%2F1/frames", ContentArchiveItemSchema, form, { signal }],
      ["/tools/media-archive/items/item%2F1/refresh", ContentArchiveTaskSchema, undefined, { signal }],
      ["/tools/xhs-archive/auth/start", XhsAuthSessionSchema, undefined, { signal }],
      ["/tools/media-archive/items/item%2F1/translation", XhsTranslationSubmissionSchema, { force: true }, { signal }],
      ["/tools/media-archive/translation/batches", XhsTranslationSubmissionSchema, batch, { signal }],
      [
        "/tools/media-archive/items/item%2F1/translation/reset",
        XhsArchiveTranslationResultSchema,
        undefined,
        { signal }
      ]
    ]);
    expect(http.patch).toHaveBeenCalledWith(
      "/tools/media-archive/items/item%2F1/translation",
      XhsArchiveTranslationResultSchema,
      edit,
      { signal }
    );
    expect(http.delete.mock.calls).toEqual([
      ["/tools/media-archive/tasks/task%2F1", ContentArchiveTaskSchema, { signal }],
      ["/tools/media-archive/items/item%2F1", XhsArchiveRemovalSchema, { signal }]
    ]);
  });
  it("默认非强制翻译，ZIP 使用中性入口并编码 ID", async () => {
    await api.translate("archive-1");
    expect(http.post).toHaveBeenCalledWith(
      "/tools/media-archive/items/archive-1/translation",
      XhsTranslationSubmissionSchema,
      { force: false },
      { signal: undefined }
    );
    expect(contentArchiveZipUrl("a/b")).toContain("/api/v1/tools/media-archive/items/a%2Fb/download.zip");
  });
});
