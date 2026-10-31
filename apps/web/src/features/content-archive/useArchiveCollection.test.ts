/** 异步列表/抽屉的代际、取消、筛选范围和显式选择回归，不依赖在线平台。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";
import { useArchiveCollection } from "./useArchiveCollection";
import { contentArchiveApi } from "./content-api";
import { ApiRequestError } from "../../shared/http/http";
import { archiveFixture, listFixture } from "./__tests__/fixtures";
vi.mock("./content-api", () => ({
  contentArchiveApi: { list: vi.fn(), detail: vi.fn(), publication: vi.fn(), setPublication: vi.fn() }
}));
const scopes: EffectScope[] = [];
function setup() {
  const scope = effectScope();
  scopes.push(scope);
  const report = vi.fn();
  const collection = scope.run(() => useArchiveCollection(report))!;
  return { scope, report, collection };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(contentArchiveApi.list).mockResolvedValue(listFixture());
  vi.mocked(contentArchiveApi.detail).mockResolvedValue(archiveFixture());
  vi.mocked(contentArchiveApi.publication)
    .mockReset()
    .mockImplementation(async (archiveId) => ({ archiveId, publishedElsewhere: false }));
  vi.mocked(contentArchiveApi.setPublication).mockImplementation(async (archiveId, publishedElsewhere) => ({
    archiveId,
    publishedElsewhere
  }));
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
});
describe("双平台归档集合", () => {
  it("不在当前列表的详情也读取独立发布状态，并可标记或撤销而不改写媒体快照", async () => {
    const { collection: c } = setup();
    vi.mocked(contentArchiveApi.list).mockResolvedValue(listFixture([]));
    vi.mocked(contentArchiveApi.publication).mockResolvedValue({ archiveId: "archive-123", publishedElsewhere: true });
    await c.loadArchives();
    await c.openDetail("archive-123");
    expect(c.detailPublication.value?.publishedElsewhere).toBe(true);
    expect(await c.setPublication("archive-123", false)).toBe(true);
    expect(c.detailPublication.value?.publishedElsewhere).toBe(false);
    const updated = archiveFixture({ totalBytes: 500 });
    c.updateItem(updated);
    expect(c.detail.value).toEqual(updated);
    expect(c.detailPublication.value?.publishedElsewhere).toBe(false);
    expect(c.archives.value.items).toEqual([]);
  });
  it("发布状态读取失败仍可查看详情，重试状态读取不重载媒体", async () => {
    const { collection: c, report } = setup();
    vi.mocked(contentArchiveApi.publication).mockRejectedValueOnce(new Error("offline"));
    await c.openDetail("archive-123");
    expect(c.detail.value?.id).toBe("archive-123");
    expect(c.detailPublication.value).toBeUndefined();
    expect(c.detailPublicationLoading.value).toBe(false);
    expect(report).toHaveBeenCalledOnce();
    await c.loadDetailPublication();
    expect(c.detailPublication.value?.publishedElsewhere).toBe(false);
    expect(contentArchiveApi.detail).toHaveBeenCalledOnce();
  });
  it("详情标记写入成功后不被迟到的旧状态读取覆盖", async () => {
    const { collection: c } = setup();
    const pending = deferred<{ archiveId: string; publishedElsewhere: boolean }>();
    vi.mocked(contentArchiveApi.publication).mockReturnValueOnce(pending.promise);
    await c.openDetail("archive-123");
    expect(c.detailPublicationLoading.value).toBe(true);
    expect(await c.setPublication("archive-123", true)).toBe(true);
    expect(c.detailPublicationLoading.value).toBe(false);
    pending.resolve({ archiveId: "archive-123", publishedElsewhere: false });
    await nextTick();
    expect(c.detailPublication.value?.publishedElsewhere).toBe(true);
  });
  it.each(["switch", "close", "dispose"])("发布状态读取中 %s 后旧响应不污染详情", async (mode) => {
    const { collection: c, scope } = setup();
    const pending = deferred<{ archiveId: string; publishedElsewhere: boolean }>();
    vi.mocked(contentArchiveApi.publication).mockReturnValueOnce(pending.promise);
    await c.openDetail("archive-123");
    const signal = vi.mocked(contentArchiveApi.publication).mock.calls[0]![1]!;
    if (mode === "switch") {
      vi.mocked(contentArchiveApi.detail).mockResolvedValueOnce(archiveFixture({ id: "archive-456" }));
      await c.openDetail("archive-456");
    } else if (mode === "close") c.drawerOpen.value = false;
    else scope.stop();
    expect(signal.aborted).toBe(true);
    pending.resolve({ archiveId: "archive-123", publishedElsewhere: true });
    await nextTick();
    expect(c.detailPublication.value?.publishedElsewhere).not.toBe(true);
    if (mode === "switch") expect(c.detailPublication.value?.archiveId).toBe("archive-456");
  });
  it("本地上传筛选可从视频编辑返回地址恢复", async () => {
    const scope = effectScope();
    scopes.push(scope);
    const c = scope.run(() => useArchiveCollection(vi.fn(), { editorReturn: "1", platform: "local", page: "2" }))!;
    await c.loadArchives();
    expect(contentArchiveApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ platform: "local", page: 2 }),
      expect.any(AbortSignal)
    );
  });
  it("从视频编辑返回时恢复筛选、排序和页码，无标记或非法参数仍用默认值", async () => {
    const scope = effectScope();
    scopes.push(scope);
    const c = scope.run(() =>
      useArchiveCollection(vi.fn(), {
        editorReturn: "1",
        keyword: "水印素材",
        type: "video",
        platform: "tiktok",
        group: "ungrouped",
        sort: "published-asc",
        page: "3"
      })
    )!;
    await c.loadArchives();
    expect(contentArchiveApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        keyword: "水印素材",
        type: "video",
        platform: "tiktok",
        groupId: "ungrouped",
        sort: "published-asc",
        page: 3
      }),
      expect.any(AbortSignal)
    );
    const defaults = scope.run(() => useArchiveCollection(vi.fn(), { keyword: "ignored", page: "999" }))!;
    expect(defaults.keyword.value).toBe("");
    expect(defaults.page.value).toBe(1);
  });
  it("marks and unmarks only the chosen archive without resetting page, order or selection", async () => {
    const { collection: c } = setup();
    await c.loadArchives();
    c.page.value = 2;
    c.toggleSelectAllArchives(true);
    const marked = listFixture();
    marked.items[0]!.publishedElsewhere = true;
    vi.mocked(contentArchiveApi.list).mockResolvedValueOnce(marked);
    expect(await c.setPublication("archive-123", true)).toBe(true);
    expect(contentArchiveApi.setPublication).toHaveBeenCalledWith("archive-123", true, expect.any(AbortSignal));
    expect(c.archives.value.items[0]?.publishedElsewhere).toBe(true);
    expect(c.page.value).toBe(2);
    expect(c.sort.value).toBe("archived-desc");
    expect(c.selectedArchiveIds.value).toEqual(["archive-123"]);
    expect(c.publicationBusyIds.value).toEqual([]);
    expect(await c.setPublication("archive-123", false)).toBe(true);
    expect(c.archives.value.items[0]?.publishedElsewhere).not.toBe(true);
    expect(await c.setPublication("missing_archive", true)).toBe(false);
    expect(contentArchiveApi.setPublication).toHaveBeenCalledTimes(2);
  });
  it("blocks duplicate publication writes, reports failures without a false badge and aborts writes on disposal", async () => {
    const { collection: c, report, scope } = setup();
    await c.loadArchives();
    const pending = deferred<{ archiveId: string; publishedElsewhere: boolean }>();
    vi.mocked(contentArchiveApi.setPublication).mockReturnValueOnce(pending.promise);
    const first = c.setPublication("archive-123", true);
    expect(c.publicationBusyIds.value).toEqual(["archive-123"]);
    expect(await c.setPublication("archive-123", true)).toBe(false);
    expect(contentArchiveApi.setPublication).toHaveBeenCalledTimes(1);
    pending.reject(new Error("write failed"));
    expect(await first).toBe(false);
    expect(report).toHaveBeenCalledOnce();
    expect(c.archives.value.items[0]?.publishedElsewhere).not.toBe(true);
    expect(c.publicationBusyIds.value).toEqual([]);
    const late = deferred<{ archiveId: string; publishedElsewhere: boolean }>();
    vi.mocked(contentArchiveApi.setPublication).mockReturnValueOnce(late.promise);
    const writing = c.setPublication("archive-123", true);
    const signal = vi.mocked(contentArchiveApi.setPublication).mock.calls.at(-1)![2]!;
    scope.stop();
    expect(signal.aborted).toBe(true);
    late.resolve({ archiveId: "archive-123", publishedElsewhere: true });
    expect(await writing).toBe(false);
    expect(c.archives.value.items[0]?.publishedElsewhere).not.toBe(true);
    expect(await c.setPublication("archive-123", true)).toBe(false);
  });
  it("rejects pre-publication list responses that arrive after the confirmed mark", async () => {
    const { collection: c } = setup();
    await c.loadArchives();
    const old = deferred<ReturnType<typeof listFixture>>();
    vi.mocked(contentArchiveApi.list).mockReturnValueOnce(old.promise);
    const reading = c.loadArchives();
    const marked = listFixture();
    marked.items[0]!.publishedElsewhere = true;
    vi.mocked(contentArchiveApi.list).mockResolvedValueOnce(marked);
    await c.setPublication("archive-123", true);
    old.resolve(listFixture());
    await reading;
    expect(c.archives.value.items[0]?.publishedElsewhere).toBe(true);
  });
  it("applies each date ordering across filters/pages, resetting selection without adding sorting to translation scope", async () => {
    const { collection: c } = setup();
    c.groupFilter.value = "group_123";
    c.platformFilter.value = "tiktok";
    c.keyword.value = "商品";
    await nextTick();
    for (const sort of ["published-desc", "published-asc", "archived-asc", "archived-desc"] as const) {
      c.page.value = 3;
      c.toggleSelectAllArchives(true);
      c.sort.value = sort;
      expect(c.page.value).toBe(1);
      expect(c.selectedArchiveIds.value).toEqual([]);
      await nextTick();
      expect(contentArchiveApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ groupId: "group_123", platform: "tiktok", keyword: "商品", sort, page: 1 }),
        expect.any(AbortSignal)
      );
      expect(c.filter()).not.toHaveProperty("sort");
      c.page.value = 2;
      await c.loadArchives();
      expect(contentArchiveApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, sort }),
        expect.any(AbortSignal)
      );
    }
  });
  it("aborts the old order immediately and ignores its late response after a new sorting request", async () => {
    const old = deferred<ReturnType<typeof listFixture>>();
    const fresh = deferred<ReturnType<typeof listFixture>>();
    vi.mocked(contentArchiveApi.list).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { collection: c } = setup();
    const first = c.loadArchives();
    c.sort.value = "published-asc";
    expect(vi.mocked(contentArchiveApi.list).mock.calls[0]![1]!.aborted).toBe(true);
    await nextTick();
    fresh.resolve(listFixture([archiveFixture({ id: "new_order" })]));
    await nextTick();
    old.resolve(listFixture([archiveFixture({ id: "old_order" })]));
    await first;
    expect(c.archives.value.items[0]?.id).toBe("new_order");
  });
  it("resets selection and pagination for group filters and keeps translation scope within the selected group", async () => {
    const { collection: c } = setup();
    await c.loadArchives();
    c.page.value = 3;
    c.toggleSelectAllArchives(true);
    c.groupFilter.value = "group_123";
    expect(c.page.value).toBe(1);
    expect(c.selectedArchiveIds.value).toEqual([]);
    await nextTick();
    expect(contentArchiveApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ groupId: "group_123", page: 1 }),
      expect.any(AbortSignal)
    );
    expect(c.filter()).toMatchObject({ groupId: "group_123" });
    c.groupFilter.value = "ungrouped";
    await nextTick();
    expect(c.filter()).toMatchObject({ groupId: "ungrouped" });
    c.groupFilter.value = "all";
    await nextTick();
    expect(c.filter()).not.toHaveProperty("groupId");
  });
  it("读取混合列表，选择只接受当前页 ID，重复选择不扩大范围", async () => {
    const { collection: c } = setup();
    await c.loadArchives();
    expect(contentArchiveApi.list).toHaveBeenCalledWith(
      { platform: "all", type: "all", keyword: "", sort: "archived-desc", page: 1, pageSize: 12 },
      expect.any(AbortSignal)
    );
    c.toggleArchiveSelection("unknown", true);
    expect(c.selectedArchiveIds.value).toEqual([]);
    c.toggleArchiveSelection("archive-123", true);
    c.toggleArchiveSelection("archive-123", true);
    expect(c.selectedArchiveIds.value).toEqual(["archive-123"]);
    c.toggleArchiveSelection("archive-123", false);
    expect(c.selectedArchiveIds.value).toEqual([]);
    c.toggleSelectAllArchives(true);
    expect(c.selectedArchiveIds.value).toEqual(["archive-123"]);
    c.toggleSelectAllArchives(false);
    expect(c.selectedArchiveIds.value).toEqual([]);
  });
  it("平台/类型切换重置分页和选择，搜索不逐字触发请求", async () => {
    const { collection: c } = setup();
    await c.loadArchives();
    c.page.value = 3;
    c.toggleSelectAllArchives(true);
    c.platformFilter.value = "douyin";
    c.typeFilter.value = "video";
    c.keyword.value = "晚霞";
    expect(c.page.value).toBe(1);
    expect(c.selectedArchiveIds.value).toEqual([]);
    await nextTick();
    await nextTick();
    expect(contentArchiveApi.list).toHaveBeenLastCalledWith(
      { platform: "douyin", type: "video", keyword: "晚霞", sort: "archived-desc", page: 1, pageSize: 12 },
      expect.any(AbortSignal)
    );
    const count = vi.mocked(contentArchiveApi.list).mock.calls.length;
    c.keyword.value = "烟花";
    await nextTick();
    expect(contentArchiveApi.list).toHaveBeenCalledTimes(count);
    expect(c.filter()).toEqual({ platform: "douyin", type: "video", keyword: "烟花" });
    c.page.value = 2;
    c.toggleSelectAllArchives(true);
    c.page.value = 3;
    expect(c.selectedArchiveIds.value).toEqual([]);
  });
  it("取消旧列表并拒绝迟到响应覆盖新筛选", async () => {
    const old = deferred<ReturnType<typeof listFixture>>();
    const fresh = deferred<ReturnType<typeof listFixture>>();
    vi.mocked(contentArchiveApi.list).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { collection: c } = setup();
    const first = c.loadArchives();
    const second = c.loadArchives();
    expect(vi.mocked(contentArchiveApi.list).mock.calls[0]![1]!.aborted).toBe(true);
    old.resolve(listFixture());
    await first;
    expect(c.listLoading.value).toBe(true);
    fresh.resolve(listFixture([archiveFixture({ id: "new", platform: "douyin" })]));
    await second;
    expect(c.archives.value.items[0]?.id).toBe("new");
    expect(c.listLoading.value).toBe(false);
  });
  it("同范围刷新保留仍存在的选择，消失的记录被移除", async () => {
    const { collection: c } = setup();
    await c.loadArchives();
    c.toggleSelectAllArchives(true);
    await c.loadArchives();
    expect(c.selectedArchiveIds.value).toEqual(["archive-123"]);
    vi.mocked(contentArchiveApi.list).mockResolvedValueOnce(listFixture([]));
    await c.loadArchives();
    expect(c.selectedArchiveIds.value).toEqual([]);
  });
  it("抽屉只接受最后打开的归档，关闭后不被迟到结果重新填充", async () => {
    const old = deferred<ReturnType<typeof archiveFixture>>();
    const fresh = deferred<ReturnType<typeof archiveFixture>>();
    vi.mocked(contentArchiveApi.detail).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { collection: c } = setup();
    const first = c.openDetail("old");
    const second = c.openDetail("new");
    expect(vi.mocked(contentArchiveApi.detail).mock.calls[0]![1]!.aborted).toBe(true);
    old.resolve(archiveFixture({ id: "old" }));
    await first;
    expect(c.detail.value).toBeUndefined();
    c.drawerOpen.value = false;
    fresh.resolve(archiveFixture({ id: "new" }));
    await second;
    expect(c.detail.value).toBeUndefined();
    expect(c.drawerOpen.value).toBe(false);
  });
  it("更新只触达同 ID 的结果与抽屉，删除对应归档后关闭抽屉", async () => {
    const { collection: c } = setup();
    const item = await c.openDetail("archive-123");
    c.current.value = item;
    c.updateItem(archiveFixture({ id: "other" }));
    expect(c.current.value?.id).toBe("archive-123");
    const updated = archiveFixture({ title: "新标题" });
    c.updateItem(updated);
    expect(c.current.value?.title).toBe("新标题");
    expect(c.detail.value?.title).toBe("新标题");
    await c.loadArchives();
    c.toggleSelectAllArchives(true);
    c.forgetItem("other");
    expect(c.drawerOpen.value).toBe(true);
    c.forgetItem("archive-123");
    expect(c.drawerOpen.value).toBe(false);
    expect(c.current.value).toBeUndefined();
    expect(c.detail.value).toBeUndefined();
    expect(c.selectedArchiveIds.value).toEqual([]);
  });
  it.each(["list", "detail"] as const)("%s 的错误有反馈，取消不提示业务失败", async (method) => {
    const { collection: c, report } = setup();
    vi.mocked(contentArchiveApi[method]).mockRejectedValueOnce(new Error("offline"));
    await (method === "list" ? c.loadArchives() : c.openDetail("archive-123"));
    expect(report).toHaveBeenCalledOnce();
    vi.mocked(contentArchiveApi[method]).mockRejectedValueOnce(
      new ApiRequestError("cancel", { code: "REQUEST_ABORTED" })
    );
    await (method === "list" ? c.loadArchives() : c.openDetail("archive-123"));
    expect(report).toHaveBeenCalledOnce();
  });
  it("迟到错误与卸载后响应不提示，不再发起请求或修改状态", async () => {
    const old = deferred<ReturnType<typeof listFixture>>();
    const pendingDetail = deferred<ReturnType<typeof archiveFixture>>();
    const { collection: c, scope, report } = setup();
    vi.mocked(contentArchiveApi.list).mockReturnValueOnce(old.promise);
    const first = c.loadArchives();
    await c.loadArchives();
    old.reject(new Error("old failure"));
    await first;
    expect(report).not.toHaveBeenCalled();
    vi.mocked(contentArchiveApi.detail).mockReturnValueOnce(pendingDetail.promise);
    const detail = c.openDetail("archive-123");
    scope.stop();
    expect(vi.mocked(contentArchiveApi.detail).mock.calls[0]![1]!.aborted).toBe(true);
    pendingDetail.resolve(archiveFixture());
    await detail;
    await c.loadArchives();
    await c.openDetail("again");
    c.updateItem(archiveFixture());
    expect(contentArchiveApi.detail).toHaveBeenCalledOnce();
    expect(c.detail.value).toBeUndefined();
    expect(report).not.toHaveBeenCalled();
  });
});
