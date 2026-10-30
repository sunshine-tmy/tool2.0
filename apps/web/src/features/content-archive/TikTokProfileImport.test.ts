// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { NCheckbox, NInput, NModal, NPagination, NSelect } from "naive-ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { TikTokProfileJob, TikTokProfilePage } from "@toolbox/shared/archive";
import TikTokProfileImport from "./TikTokProfileImport.vue";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  works: vi.fn(),
  create: vi.fn(),
  archive: vi.fn(),
  discover: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  retryWork: vi.fn(),
  remove: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  copy: vi.fn(),
  confirm: vi.fn()
}));
vi.mock("./content-api", () => ({
  tiktokProfileApi: mocks,
  tiktokProfileResultsUrl: (id: string) => `/profile/${id}/results.csv`
}));
vi.mock("naive-ui", async (original) => ({
  ...(await original<object>()),
  useMessage: () => ({ error: mocks.error, warning: mocks.warning, success: mocks.success })
}));
vi.mock("../../shared/utils/clipboard", () => ({ copyTextToClipboard: mocks.copy }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
let current: TikTokProfileJob;
const wrappers: ReturnType<typeof mount>[] = [];
const base: TikTokProfileJob = {
  id: "profile_123",
  username: "shop",
  url: "https://www.tiktok.com/@shop",
  phase: "ready",
  complete: false,
  discoveredCount: 2,
  declaredCount: 616,
  message: "列表未确认完整",
  createdAt: "2026-10-27T00:00:00Z",
  updatedAt: "2026-10-27T00:00:00Z",
  archivedCount: 0,
  failedCount: 0,
  skippedCount: 0,
  pendingCount: 0,
  batchCount: 0
};
const work = (id: string) => ({ id, url: `https://www.tiktok.com/@shop/video/${id}`, title: `商品${id}` });
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  current = { ...base };
  mocks.list.mockResolvedValue([]);
  mocks.get.mockImplementation(async () => ({ ...current }));
  mocks.works.mockImplementation(async (_id: string, page: number): Promise<TikTokProfilePage> => ({
    items: [work(page === 1 ? "12345" : "12346")],
    page,
    pageCount: 2,
    total: 2
  }));
  mocks.create.mockImplementation(async () => ({ ...current }));
  mocks.archive.mockImplementation(async () => (current = { ...current, phase: "archiving", pendingCount: 2 }));
  mocks.confirm.mockResolvedValue(true);
  mocks.remove.mockResolvedValue({ removed: true });
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
});
function setup() {
  const Modal = defineComponent({
    props: { show: Boolean },
    template: '<div v-if="show"><slot /><slot name="footer" /></div>'
  });
  const wrapper = mount(TikTokProfileImport, {
    props: { groups: [{ id: "group_123", name: "素材组", createdAt: base.createdAt, updatedAt: base.updatedAt }] },
    global: {
      stubs: {
        Teleport: true,
        NModal: Modal,
        "n-modal": Modal,
        NSpin: defineComponent({ template: "<div><slot /></div>" })
      }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
it("主页作品分页使用已发现作品总数，翻页不把总数替换为本页条数或主页预计数", async () => {
  mocks.list.mockResolvedValue([current]);
  mocks.works.mockImplementation(async (_id: string, page: number) => ({
    items: [work(`1234${page}`)],
    page,
    pageCount: 3,
    total: 142
  }));
  const wrapper = setup();
  await wrapper.vm.show(current.id);
  expect(wrapper.findAll("tbody tr")).toHaveLength(1);
  expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 142 条");
  wrapper.getComponent(NPagination).vm.$emit("update:page", 2);
  await flushPromises();
  expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 142 条");
  expect(mocks.works).toHaveBeenLastCalledWith(current.id, 2, expect.any(AbortSignal));
});
it("retries just the failed row while archiving, then exposes the queued status without a second request", async () => {
  current = { ...base, phase: "archiving", failedCount: 1 };
  mocks.list.mockResolvedValue([current]);
  let status: "failed" | "waiting" = "failed";
  mocks.works.mockImplementation(async () => ({
    items: [{ ...work("12345"), outcome: { status, progress: 0, message: "失败" } }],
    page: 1,
    pageCount: 1,
    total: 1
  }));
  mocks.retryWork.mockImplementation(async () => {
    status = "waiting";
    return { ...current, failedCount: 0, pendingCount: 1 };
  });
  const wrapper = setup();
  await wrapper.vm.show(current.id);
  const button = wrapper.findAll("button").find((button) => button.text() === "重试")!;
  expect(button.attributes("disabled")).toBeUndefined();
  await click(wrapper, "重试");
  expect(mocks.retryWork).toHaveBeenCalledExactlyOnceWith(current.id, "12345", expect.any(AbortSignal));
  expect(mocks.retry).not.toHaveBeenCalled();
  expect(wrapper.findAll("button").some((button) => button.text() === "重试")).toBe(false);
});
it("keeps failed rows retryable after a request error and renders matching successes after reopening", async () => {
  current = { ...base, phase: "completed", failedCount: 1 };
  mocks.list.mockResolvedValue([current]);
  mocks.works.mockResolvedValue({
    items: [{ ...work("12345"), outcome: { status: "failed", progress: 0, message: "网络失败" } }],
    page: 1,
    pageCount: 1,
    total: 1
  });
  mocks.retryWork.mockRejectedValueOnce(new Error("offline"));
  const wrapper = setup();
  await wrapper.vm.show(current.id);
  await click(wrapper, "重试");
  expect(mocks.error).toHaveBeenCalled();
  expect(
    wrapper
      .findAll("button")
      .find((button) => button.text() === "重试")!
      .attributes("disabled")
  ).toBeUndefined();
  await wrapper.get("a.profile-work-link").trigger("click");
  current = { ...current, failedCount: 0, archivedCount: 1 };
  mocks.works.mockResolvedValue({
    items: [
      {
        ...work("12345"),
        outcome: { status: "completed", progress: 100, archiveId: "archive_123", message: "已匹配单条成功归档" }
      }
    ],
    page: 1,
    pageCount: 1,
    total: 1
  });
  await wrapper.vm.show(current.id);
  expect(wrapper.text()).toContain("100%");
  await click(wrapper, "查看存档");
  expect(wrapper.emitted("openArchive")?.[0]).toEqual(["archive_123"]);
});
it("hands work links to the ordinary form without auto-archiving, while modified clicks keep the external link", async () => {
  mocks.list.mockResolvedValue([current]);
  const wrapper = setup();
  await wrapper.vm.show(current.id);
  const link = wrapper.get("a.profile-work-link");
  expect(link.attributes("href")).toBe(work("12345").url);
  await link.trigger("click", { ctrlKey: true });
  expect(wrapper.emitted("retrySingle")).toBeUndefined();
  await link.trigger("click");
  expect(wrapper.emitted("retrySingle")?.[0]).toEqual([work("12345").url]);
  expect(mocks.archive).not.toHaveBeenCalled();
  expect(mocks.retryWork).not.toHaveBeenCalled();
  expect(wrapper.find("a.profile-work-link").exists()).toBe(false);
});
async function click(wrapper: ReturnType<typeof setup>, label: string) {
  await wrapper
    .findAll("button")
    .find((button) => button.text() === label)!
    .trigger("click");
  await flushPromises();
}
it.each([false, true])(
  "clears the actual history select after deleting a chosen task (other history: %s)",
  async (keepOther) => {
    const selected = { ...base, id: "profile_delete", username: "other", url: "https://www.tiktok.com/@other" };
    mocks.list.mockResolvedValue([base, selected]);
    mocks.get.mockImplementation(async (id: string) => (id === selected.id ? selected : base));
    const wrapper = setup();
    await wrapper.vm.show(base.id);
    const history = wrapper
      .findAllComponents(NSelect)
      .find((select) => select.attributes("aria-label") === "TikTok 主页任务历史")!;
    await history.get(".n-base-selection").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(100);
    await history.get(".n-base-selection").trigger("keydown", { key: "ArrowDown" });
    await history.get(".n-base-selection").trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(history.props("value")).toBe(selected.id);
    mocks.list.mockResolvedValue(keepOther ? [base, selected] : [selected]);
    await click(wrapper, "刷新历史");
    await click(wrapper, "删除主页任务记录");
    expect(mocks.remove).toHaveBeenCalledWith(selected.id, expect.any(AbortSignal));
    expect(history.text()).toContain("查看主页任务历史");
    expect(history.text()).not.toContain(selected.id);
    expect(history.props("value")).toBeNull();
    expect(history.props("options")).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ value: selected.id })])
    );
    expect(history.props("options")).toHaveLength(keepOther ? 1 : 0);
    expect(wrapper.find(".profile-table").exists()).toBe(false);
    expect(wrapper.text()).toContain("先读取主页作品并核对列表，再确认归档");
    expect(wrapper.findAll("button").some((button) => button.text() === "删除主页任务记录")).toBe(false);
    const calls = mocks.get.mock.calls.length;
    await vi.advanceTimersByTimeAsync(4000);
    expect(mocks.get).toHaveBeenCalledTimes(calls);
    if (keepOther) {
      history.vm.$emit("update:value", base.id);
      await flushPromises();
      expect(mocks.get).toHaveBeenLastCalledWith(base.id, expect.any(AbortSignal));
    }
  }
);
it("keeps a failed deletion selected and ignores a late history response after a successful deletion", async () => {
  mocks.list.mockResolvedValue([base]);
  const wrapper = setup();
  await wrapper.vm.show(base.id);
  const history = wrapper
    .findAllComponents(NSelect)
    .find((select) => select.attributes("aria-label") === "TikTok 主页任务历史")!;
  mocks.remove.mockRejectedValueOnce(new Error("delete failed"));
  await click(wrapper, "删除主页任务记录");
  expect(mocks.error).toHaveBeenCalledOnce();
  expect(history.props("value")).toBe(base.id);
  expect(history.text()).toContain("@shop");
  expect(wrapper.find(".profile-table").exists()).toBe(true);
  let finishHistory!: (value: TikTokProfileJob[]) => void;
  mocks.list.mockReturnValueOnce(
    new Promise<TikTokProfileJob[]>((resolve) => {
      finishHistory = resolve;
    })
  );
  await click(wrapper, "刷新历史");
  await click(wrapper, "删除主页任务记录");
  finishHistory([base]);
  await flushPromises();
  expect(history.props("value")).toBeNull();
  expect(history.props("options")).toEqual([]);
  expect(history.text()).toContain("查看主页任务历史");
  expect(wrapper.find(".profile-table").exists()).toBe(false);
});
it("opens the requested owner and replaces deleted history selections without requesting stale IDs", async () => {
  const second = { ...base, id: "profile_456" };
  mocks.list.mockResolvedValue([base, second]);
  mocks.get.mockImplementation(async (id: string) => (id === second.id ? second : base));
  const wrapper = setup();
  await wrapper.vm.show(second.id);
  expect(mocks.get).toHaveBeenLastCalledWith(second.id, expect.any(AbortSignal));
  wrapper
    .findAllComponents(NCheckbox)
    .find((checkbox) => checkbox.attributes("aria-label") === "选择作品 12345")!
    .vm.$emit("update:checked", true);
  await flushPromises();
  await wrapper.vm.show(second.id);
  expect(
    wrapper
      .findAllComponents(NCheckbox)
      .find((checkbox) => checkbox.attributes("aria-label") === "选择作品 12345")!
      .props("checked")
  ).toBe(true);
  mocks.list.mockResolvedValue([base]);
  await wrapper.vm.show();
  expect(mocks.get).toHaveBeenLastCalledWith(base.id, expect.any(AbortSignal));
  mocks.list.mockResolvedValue([]);
  mocks.get.mockClear();
  await wrapper.vm.show();
  expect(mocks.get).not.toHaveBeenCalled();
  expect(wrapper.findAll("button").some((button) => button.text() === "删除主页任务记录")).toBe(false);
});
it("requires a deliberate partial confirmation, retains cross-page selection and forwards policy and target group", async () => {
  const wrapper = setup();
  await click(wrapper, "TikTok 主页批量归档");
  wrapper.getComponent(NInput).vm.$emit("update:value", "https://www.tiktok.com/@SHOP?_t=example");
  await flushPromises();
  await click(wrapper, "读取主页作品");
  expect(mocks.create).toHaveBeenCalledWith("https://www.tiktok.com/@shop", expect.any(AbortSignal));
  expect(mocks.archive).not.toHaveBeenCalled();
  expect(wrapper.text()).toContain("列表未确认完整");
  const start = wrapper.findAll("button").find((button) => button.text() === "确认并开始主页归档")!;
  expect(start.attributes("disabled")).toBeDefined();
  wrapper
    .findAllComponents(NCheckbox)
    .find((checkbox) => checkbox.text().includes("确认仅归档"))!
    .vm.$emit("update:checked", true);
  wrapper
    .findAllComponents(NSelect)
    .find((select) => select.attributes("aria-label") === "主页作品归档范围")!
    .vm.$emit("update:value", "selected");
  wrapper
    .findAllComponents(NSelect)
    .find((select) => select.attributes("aria-label") === "主页归档目标分组")!
    .vm.$emit("update:value", "group_123");
  await flushPromises();
  const target = wrapper
    .findAllComponents(NSelect)
    .find((select) => select.attributes("aria-label") === "主页归档目标分组")!;
  await wrapper.setProps({ groups: [] });
  expect(target.props("value")).toBeNull();
  expect(target.text()).toContain("成功结果分组（可选）");
  expect(target.text()).not.toContain("group_123");
  await wrapper.setProps({
    groups: [{ id: "group_123", name: "素材组", createdAt: base.createdAt, updatedAt: base.updatedAt }]
  });
  target.vm.$emit("update:value", "group_123");
  wrapper
    .findAllComponents(NCheckbox)
    .find((checkbox) => checkbox.attributes("aria-label") === "选择作品 12345")!
    .vm.$emit("update:checked", true);
  await flushPromises();
  wrapper.getComponent(NPagination).vm.$emit("update:page", 2);
  await flushPromises();
  wrapper
    .findAllComponents(NCheckbox)
    .find((checkbox) => checkbox.attributes("aria-label") === "选择作品 12346")!
    .vm.$emit("update:checked", true);
  await flushPromises();
  await click(wrapper, "确认并开始主页归档");
  expect(mocks.archive).toHaveBeenCalledWith(
    "profile_123",
    { selection: "selected", itemIds: ["12345", "12346"], existing: "skip", groupId: "group_123", allowPartial: true },
    expect.any(AbortSignal)
  );
  expect(wrapper.get('a[href="/profile/profile_123/results.csv"]').text()).toBe("导出作品与结果 CSV");
  const calls = mocks.get.mock.calls.length;
  wrapper.getComponent(NModal).vm.$emit("update:show", false);
  await flushPromises();
  await vi.advanceTimersByTimeAsync(4000);
  expect(mocks.get).toHaveBeenCalledTimes(calls);
  expect(mocks.cancel).not.toHaveBeenCalled();
});
it("polls progress, emits archive updates, stops/retries explicitly and deletes metadata only after confirmation", async () => {
  current = { ...base, phase: "archiving", complete: true, pendingCount: 1 };
  mocks.list.mockResolvedValue([current]);
  const wrapper = setup();
  await click(wrapper, "TikTok 主页批量归档");
  current = { ...current, phase: "completed", archivedCount: 1, failedCount: 1, pendingCount: 0 };
  await vi.advanceTimersByTimeAsync(2000);
  await flushPromises();
  expect(wrapper.emitted("changed")).toHaveLength(1);
  mocks.retry.mockImplementation(async () => (current = { ...current, phase: "archiving" }));
  await click(wrapper, "继续未完成 / 重试失败项");
  expect(mocks.retry).toHaveBeenCalledWith("profile_123", expect.any(AbortSignal));
  mocks.cancel.mockImplementation(async () => (current = { ...current, phase: "cancelled" }));
  await click(wrapper, "停止后续操作");
  expect(mocks.cancel).toHaveBeenCalledOnce();
  mocks.confirm.mockResolvedValueOnce(false);
  await click(wrapper, "删除主页任务记录");
  expect(mocks.remove).not.toHaveBeenCalled();
  await click(wrapper, "删除主页任务记录");
  expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("作品、媒体和分组均保留"), expect.any(Object));
  expect(mocks.remove).toHaveBeenCalledWith("profile_123", expect.any(AbortSignal));
});
it("rejects invalid profiles, reports errors and aborts late reads when disposed", async () => {
  const wrapper = setup();
  await click(wrapper, "TikTok 主页批量归档");
  wrapper.getComponent(NInput).vm.$emit("update:value", "https://evil.test/@shop");
  await flushPromises();
  await click(wrapper, "读取主页作品");
  expect(mocks.warning).toHaveBeenCalledOnce();
  expect(mocks.create).not.toHaveBeenCalled();
  wrapper.getComponent(NInput).vm.$emit("update:value", base.url);
  await flushPromises();
  mocks.create.mockRejectedValueOnce(new Error("network failed"));
  await click(wrapper, "读取主页作品");
  expect(mocks.error).toHaveBeenCalledOnce();
  mocks.list.mockResolvedValue([current]);
  let resolve!: (job: TikTokProfileJob) => void;
  mocks.get.mockReturnValueOnce(
    new Promise<TikTokProfileJob>((done) => {
      resolve = done;
    })
  );
  const showing = click(wrapper, "TikTok 主页批量归档");
  await flushPromises();
  const signal = mocks.get.mock.calls.at(-1)?.[1] as AbortSignal;
  wrapper.unmount();
  wrappers.splice(wrappers.indexOf(wrapper), 1);
  expect(signal.aborted).toBe(true);
  resolve(current);
  await showing;
  expect(mocks.cancel).not.toHaveBeenCalled();
});
it("offers the optional normal-browser collector without submitting jobs and releases its helper download URL", async () => {
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:collector");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  const wrapper = setup();
  await click(wrapper, "TikTok 主页批量归档");
  expect(wrapper.text()).toContain("先停止当前读取");
  await click(wrapper, "下载普通浏览器采集助手");
  await click(wrapper, "下载普通浏览器采集助手");
  expect(create).toHaveBeenCalledOnce();
  const blob = create.mock.calls[0]![0] as Blob;
  expect(blob.type).toContain("text/html");
  expect(await blob.text()).toContain("采集 TikTok 作品");
  await click(wrapper, "复制采集书签地址");
  expect(mocks.copy).toHaveBeenCalledWith(expect.stringMatching(/^javascript:/));
  expect(mocks.success).toHaveBeenCalledOnce();
  mocks.copy.mockRejectedValueOnce(new Error("copy failed"));
  await click(wrapper, "复制采集书签地址");
  expect(mocks.error).toHaveBeenCalledOnce();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.archive).not.toHaveBeenCalled();
  expect(mocks.cancel).not.toHaveBeenCalled();
  wrapper.unmount();
  wrappers.splice(wrappers.indexOf(wrapper), 1);
  expect(revoke).toHaveBeenCalledWith("blob:collector");
  vi.restoreAllMocks();
});
