/**
 * 中文模块说明：测试 frontend/src/modules/xhs-archive/api.test.ts 中的稳定行为、边界条件和回归场景
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  XhsArchiveListResponseSchema,
  XhsArchiveRemovalSchema,
  XhsArchiveTaskSchema,
  XhsArchiveTranslationResultSchema
} from "@toolbox/shared";
import { xhsArchiveApi } from "./api";

const httpMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: httpMock
}));

describe("XHS archive api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const method of Object.values(httpMock)) method.mockResolvedValue({});
  });

  // 将获取、登录、翻译和编辑串成一条契约回归，确保所有操作都走正式的 /api/v1 命名空间。
  it("routes archive, authentication, and translation operations through the v1 client", async () => {
    await xhsArchiveApi.runtime();
    await xhsArchiveApi.create("https://www.xiaohongshu.com/explore/one");
    await xhsArchiveApi.task("task-1");
    await xhsArchiveApi.list({ keyword: "咖啡", page: 2, pageSize: 10 });
    await xhsArchiveApi.detail("item-1");
    await xhsArchiveApi.refresh("item-1");
    await xhsArchiveApi.remove("item-1");
    await xhsArchiveApi.startAuth();
    await xhsArchiveApi.auth("auth-1");
    await xhsArchiveApi.translationRuntime();
    await xhsArchiveApi.translate("item-1", true);
    await xhsArchiveApi.translationTask("translation-1");
    await xhsArchiveApi.translateBatch({ mode: "selected", itemIds: ["item-1"] });
    const edit = {
      sourceHash: "hash",
      title: { edited: "Coffee" },
      topics: [{ topicId: "topic-1", edited: "Cafe" }]
    };
    await xhsArchiveApi.editTranslation("item-1", edit);
    await xhsArchiveApi.resetTranslation("item-1");

    expect(httpMock.get).toHaveBeenCalledWith("/tools/xhs-archive/items", XhsArchiveListResponseSchema, {
      params: { keyword: "咖啡", page: 2, pageSize: 10 }
    });
    expect(httpMock.post).toHaveBeenCalledWith("/tools/xhs-archive/items", XhsArchiveTaskSchema, {
      url: "https://www.xiaohongshu.com/explore/one"
    });
    expect(httpMock.patch).toHaveBeenCalledWith(
      "/tools/xhs-archive/items/item-1/translation",
      XhsArchiveTranslationResultSchema,
      edit
    );
    expect(httpMock.delete).toHaveBeenCalledWith("/tools/xhs-archive/items/item-1", XhsArchiveRemovalSchema);
  });
});
