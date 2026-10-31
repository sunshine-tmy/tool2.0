/** 中性客户端的路径、契约、编码和取消传播。 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContentArchiveItemSchema,
  LocalArchiveUploadResultSchema,
  ContentArchiveListResponseSchema,
  ContentArchiveTaskSchema,
  ContentArchivePublicationSchema,
  ContentTranslationTaskSchema,
  DouyinRuntimeStatusSchema,
  TikTokRuntimeStatusSchema,
  ArchiveImportBatchSchema,
  ArchiveImportPreviewSchema,
  ArchiveImportListSchema,
  ArchiveGroupSchema,
  ArchiveGroupListSchema,
  ArchiveGroupAssignmentResultSchema,
  TikTokProfileJobSchema,
  TikTokProfileListSchema,
  TikTokProfilePageSchema,
  XhsArchiveRemovalSchema,
  XhsArchiveTranslationResultSchema,
  XhsAuthSessionSchema,
  XhsRuntimeStatusSchema,
  XhsTranslationRuntimeStatusSchema,
  XhsTranslationSubmissionSchema
} from "@toolbox/shared";
import {
  contentArchiveApi as api,
  uploadLocalArchiveVideo,
  contentArchiveZipUrl,
  archiveImportApi,
  archiveImportTemplateUrl,
  archiveImportResultUrl,
  archiveGroupApi,
  tiktokProfileApi,
  tiktokProfileResultsUrl
} from "./content-api";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../shared/http/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: http
}));
beforeEach(() => {
  vi.clearAllMocks();
  Object.values(http).forEach((method) => method.mockResolvedValue({}));
});

describe("多媒体归档客户端", () => {
  it("删除截帧编码归档和媒体 ID，校验更新后的归档并传递取消信号", async () => {
    const signal = new AbortController().signal;
    await api.removeFrame("id/123", "frame/456", signal);
    expect(http.delete).toHaveBeenLastCalledWith(
      "/tools/media-archive/items/id%2F123/frames/frame%2F456",
      ContentArchiveItemSchema,
      { signal }
    );
  });
  it("本地批量队列按单文件提交，保留统一传输、取消、进度和严格返回契约", async () => {
    const file = new File(["video"], "我的视频.mp4", { type: "video/mp4" }),
      controller = new AbortController(),
      progress = vi.fn();
    await uploadLocalArchiveVideo(file, "归档标题", controller.signal, progress);
    const [url, schema, form, options] = http.post.mock.calls[0];
    expect(url).toBe("/tools/media-archive/local-videos");
    expect(schema).toBe(LocalArchiveUploadResultSchema);
    expect(form.get("title")).toBe("归档标题");
    expect(form.get("file").name).toBe(file.name);
    expect(options.signal).toBe(controller.signal);
    expect(options.timeout).toBe(30 * 60 * 1000);
    options.onUploadProgress({ loaded: 5, total: 10 });
    expect(progress).toHaveBeenCalledWith(50);
    expect([...form.keys()]).toEqual(["title", "file"]);
    await uploadLocalArchiveVideo(file, "归档标题", controller.signal, progress, "group-123");
    const groupedForm = http.post.mock.calls[1][2];
    expect([...groupedForm.keys()]).toEqual(["title", "groupId", "file"]);
    expect(groupedForm.get("groupId")).toBe("group-123");
    expect(groupedForm.getAll("file")).toHaveLength(1);
  });
  it("encodes the publication target and preserves strict response validation and cancellation", async () => {
    const signal = new AbortController().signal;
    await api.publication("id/123", signal);
    expect(http.get).toHaveBeenLastCalledWith(
      "/tools/media-archive/items/id%2F123/publication",
      ContentArchivePublicationSchema,
      { signal }
    );
    for (const publishedElsewhere of [true, false]) {
      await api.setPublication("id/123", publishedElsewhere, signal);
      expect(http.patch).toHaveBeenLastCalledWith(
        "/tools/media-archive/items/id%2F123/publication",
        ContentArchivePublicationSchema,
        { publishedElsewhere },
        { signal }
      );
    }
  });
  it("encodes profile IDs and preserves cancellation and schema validation across discovery and archive actions", async () => {
    const signal = new AbortController().signal;
    await tiktokProfileApi.list(signal);
    expect(http.get).toHaveBeenLastCalledWith("/tools/media-archive/tiktok-profiles", TikTokProfileListSchema, {
      signal
    });
    await tiktokProfileApi.create("https://www.tiktok.com/@shop", signal);
    expect(http.post).toHaveBeenLastCalledWith(
      "/tools/media-archive/tiktok-profiles",
      TikTokProfileJobSchema,
      { url: "https://www.tiktok.com/@shop" },
      { signal }
    );
    await tiktokProfileApi.get("id/123", signal);
    expect(http.get).toHaveBeenLastCalledWith("/tools/media-archive/tiktok-profiles/id%2F123", TikTokProfileJobSchema, {
      signal
    });
    await tiktokProfileApi.works("id/123", 2, signal);
    expect(http.get).toHaveBeenLastCalledWith(
      "/tools/media-archive/tiktok-profiles/id%2F123/works?page=2",
      TikTokProfilePageSchema,
      { signal }
    );
    const input = { selection: "all" as const, existing: "skip" as const, allowPartial: false };
    await tiktokProfileApi.archive("id/123", input, signal);
    expect(http.post).toHaveBeenLastCalledWith(
      "/tools/media-archive/tiktok-profiles/id%2F123/archive",
      TikTokProfileJobSchema,
      input,
      { signal }
    );
    for (const action of ["discover", "cancel", "retry"] as const) {
      await tiktokProfileApi[action]("id/123", signal);
      expect(http.post).toHaveBeenLastCalledWith(
        `/tools/media-archive/tiktok-profiles/id%2F123/${action}`,
        TikTokProfileJobSchema,
        undefined,
        { signal }
      );
    }
    await tiktokProfileApi.retryWork("id/123", "12345", signal);
    expect(http.post).toHaveBeenLastCalledWith(
      "/tools/media-archive/tiktok-profiles/id%2F123/retry",
      TikTokProfileJobSchema,
      { itemId: "12345" },
      { signal }
    );
    await tiktokProfileApi.remove("id/123", signal);
    expect(http.delete).toHaveBeenLastCalledWith(
      "/tools/media-archive/tiktok-profiles/id%2F123",
      XhsArchiveRemovalSchema,
      { signal }
    );
    expect(tiktokProfileResultsUrl("id/123")).toContain("id%2F123/results.csv");
  });
  it("uses explicit group contracts, encoded identifiers and abort signals", async () => {
    const signal = new AbortController().signal;
    await archiveGroupApi.list(signal);
    expect(http.get).toHaveBeenLastCalledWith("/tools/media-archive/groups", ArchiveGroupListSchema, { signal });
    await archiveGroupApi.save("名称", undefined, signal);
    expect(http.post).toHaveBeenLastCalledWith(
      "/tools/media-archive/groups",
      ArchiveGroupSchema,
      { name: "名称" },
      { signal }
    );
    await archiveGroupApi.save("改名", "id/123", signal);
    expect(http.patch).toHaveBeenLastCalledWith(
      "/tools/media-archive/groups/id%2F123",
      ArchiveGroupSchema,
      { name: "改名" },
      { signal }
    );
    const input = { groupId: null, itemIds: ["archive_123"] };
    await archiveGroupApi.assign(input, signal);
    expect(http.post).toHaveBeenLastCalledWith(
      "/tools/media-archive/groups/assign",
      ArchiveGroupAssignmentResultSchema,
      input,
      { signal }
    );
    await archiveGroupApi.remove("id/123", signal);
    expect(http.delete).toHaveBeenLastCalledWith("/tools/media-archive/groups/id%2F123", XhsArchiveRemovalSchema, {
      signal
    });
  });
  it("uses bounded spreadsheet contracts and propagates cancellation through every batch action", async () => {
    const signal = new AbortController().signal,
      file = new File(["url"], "batch.csv");
    await archiveImportApi.preview(file, signal);
    expect(http.post).toHaveBeenLastCalledWith(
      "/tools/media-archive/import/preview",
      ArchiveImportPreviewSchema,
      expect.any(FormData),
      { signal }
    );
    const form = http.post.mock.calls.at(-1)?.[2] as FormData;
    expect(form.get("file")).toBe(file);
    const input = {
      sourceName: "batch.csv",
      existing: "skip" as const,
      rows: [{ rowNumber: 2, inputUrl: "https://vt.tiktok.com/AAAAA/", inputPlatform: "" }]
    };
    await archiveImportApi.create(input, signal);
    expect(http.post).toHaveBeenLastCalledWith("/tools/media-archive/import/batches", ArchiveImportBatchSchema, input, {
      signal
    });
    await archiveImportApi.list(signal);
    expect(http.get).toHaveBeenLastCalledWith("/tools/media-archive/import/batches", ArchiveImportListSchema, {
      signal
    });
    await archiveImportApi.get("id/123", signal);
    expect(http.get).toHaveBeenLastCalledWith(
      "/tools/media-archive/import/batches/id%2F123",
      ArchiveImportBatchSchema,
      { signal }
    );
    await archiveImportApi.cancel("id/123", signal);
    expect(http.post).toHaveBeenLastCalledWith(
      "/tools/media-archive/import/batches/id%2F123/cancel",
      ArchiveImportBatchSchema,
      undefined,
      { signal }
    );
    await archiveImportApi.retry("id/123", signal);
    expect(http.post).toHaveBeenLastCalledWith(
      "/tools/media-archive/import/batches/id%2F123/retry",
      ArchiveImportBatchSchema,
      undefined,
      { signal }
    );
    await archiveImportApi.remove("id/123", signal);
    expect(http.delete).toHaveBeenLastCalledWith(
      "/tools/media-archive/import/batches/id%2F123",
      XhsArchiveRemovalSchema,
      { signal }
    );
    expect(archiveImportTemplateUrl()).toContain("/api/v1/tools/media-archive/import/template.csv");
    expect(archiveImportResultUrl("id/123")).toContain("id%2F123/results.csv");
  });
  it("reads the TikTok anonymous runtime through its schema and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    await api.tiktokRuntime(signal);
    expect(http.get).toHaveBeenCalledWith("/tools/media-archive/runtime/tiktok", TikTokRuntimeStatusSchema, { signal });
    await api.create({ url: "https://vt.tiktok.com/ZSgQrEYNG/", platform: "tiktok" }, signal);
    expect(http.post).toHaveBeenCalledWith(
      "/tools/media-archive/items",
      ContentArchiveTaskSchema,
      { url: "https://vt.tiktok.com/ZSgQrEYNG/", platform: "tiktok" },
      { signal }
    );
  });
  it("所有 JSON 操作传入共享响应 Schema 和同一 AbortSignal", async () => {
    const signal = new AbortController().signal;
    const params = {
      platform: "douyin" as const,
      keyword: "晚霞",
      type: "video" as const,
      sort: "published-asc" as const,
      page: 2,
      pageSize: 12
    };
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
