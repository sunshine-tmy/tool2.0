/** 异步列表/抽屉的代际、取消、筛选范围和显式选择回归，不依赖在线平台。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";
import { useArchiveCollection } from "./useArchiveCollection";
import { contentArchiveApi } from "./content-api";
import { ApiRequestError } from "../../services/http";
import { archiveFixture, listFixture } from "./__tests__/fixtures";
vi.mock("./content-api", () => ({ contentArchiveApi: { list: vi.fn(), detail: vi.fn() } }));
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
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
});
describe("双平台归档集合", () => {
  it("读取混合列表，选择只接受当前页 ID，重复选择不扩大范围", async () => {
    const { collection: c } = setup();
    await c.loadArchives();
    expect(contentArchiveApi.list).toHaveBeenCalledWith(
      { platform: "all", type: "all", keyword: "", page: 1, pageSize: 12 },
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
      { platform: "douyin", type: "video", keyword: "晚霞", page: 1, pageSize: 12 },
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
