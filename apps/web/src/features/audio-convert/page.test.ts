// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NButton, NCheckbox, NPagination, NSelect } from "naive-ui";
import Page from "./page.vue";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  groups: vi.fn(),
  confirm: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  guard: vi.fn(),
  route: { query: { archiveId: "archive123", mediaId: "media123", returnTo: "/tools/media-archive?page=3" } }
}));
vi.mock("./api", () => ({
  audioConvertApi: {
    list: mocks.list,
    add: mocks.add,
    remove: mocks.remove,
    download: (id: string) => `/download/${id}`
  }
}));
vi.mock("../audio-library/integrations/conversion", () => ({ conversionLibraryApi: { list: mocks.groups } }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("vue-router", () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push }),
  onBeforeRouteLeave: mocks.guard
}));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => ({ success: mocks.success })
}));
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.add.mockReset();
  mocks.list.mockReset().mockImplementation(async (page: number) => ({
    items: [job(page === 1 ? "converted123" : "another456")],
    total: 51
  }));
  mocks.groups.mockResolvedValue({ groups: [{ id: "group123", name: "背景音乐" }] });
  mocks.add.mockResolvedValue({ item: { id: "music123", available: true }, existing: false });
  mocks.remove.mockResolvedValue({ ok: true });
  mocks.confirm.mockResolvedValue(false);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
});
async function setup(lightControls = false) {
  wrapper = mount(Page, {
    global: {
      stubs: {
        ToolLayout: { template: "<main><slot /></main>" },
        ToolPageHeader: true,
        RouterLink: { template: "<a><slot /></a>" },
        NModal: { template: "<section><slot /></section>" },
        ...(lightControls
          ? {
              NButton: { template: "<button><slot /></button>" },
              NCheckbox: { template: "<label><slot /></label>" },
              NProgress: true
            }
          : {})
      }
    }
  });
  await flushPromises();
  return wrapper;
}
function button(w: VueWrapper, text: string) {
  return w.findAllComponents(NButton).find((b) => b.text() === text)!;
}
function job(id: string) {
  return {
    id,
    name: `${id}.flac`,
    bitrate: 192,
    status: "completed",
    progress: 100,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01"
  };
}
async function selectPage(w: VueWrapper, checked = true) {
  w.findAllComponents(NCheckbox)
    .find((c) => c.text() === "全选本页成功结果")!
    .vm.$emit("update:checked", checked);
  await flushPromises();
}
it("removes both redundant buttons and keeps page selection reversible", async () => {
  const w = await setup();
  await selectPage(w);
  expect(w.text()).toContain("已选 1 条");
  expect(button(w, "全选全部成功结果")).toBeUndefined();
  expect(button(w, "清空选择")).toBeUndefined();
  await selectPage(w, false);
  expect(w.text()).toContain("已选 0 条");
});
it("shows the total, selects completed results and confirms deletion", async () => {
  const w = await setup();
  expect(w.text()).toContain("转换记录 · 共 51 条");
  const check = w.findAllComponents(NCheckbox).find((c) => c.text() === "全选本页成功结果")!;
  check.vm.$emit("update:checked", true);
  await flushPromises();
  await button(w, "删除所选").trigger("click");
  await flushPromises();
  expect(mocks.remove).not.toHaveBeenCalled();
  mocks.confirm.mockResolvedValue(true);
  await button(w, "删除所选").trigger("click");
  await flushPromises();
  expect(mocks.remove).toHaveBeenCalledWith("converted123");
});
it("adds an independent library item in the chosen group and returns to the original editor", async () => {
  const w = await setup();
  await button(w, "加入音频素材库").trigger("click");
  await flushPromises();
  w.findAllComponents(NSelect)
    .find((s) => s.attributes("aria-label") === "目标分组")!
    .vm.$emit("update:value", "group123");
  await flushPromises();
  await button(w, "加入并返回视频编辑").trigger("click");
  await flushPromises();
  expect(mocks.add).toHaveBeenCalledWith("converted123", "group123", "music");
  expect(mocks.push).toHaveBeenCalledWith({
    name: "archive-video-editor",
    params: { itemId: "archive123", mediaId: "media123" },
    query: { panel: "audio", convertedMusic: "music123", returnTo: "/tools/media-archive?page=3" }
  });
});
it("does not return a recycled duplicate to the editor", async () => {
  mocks.add.mockResolvedValue({ item: { id: "music123", deletedAt: "2026-10-01" }, existing: true });
  const w = await setup();
  await button(w, "加入音频素材库").trigger("click");
  await flushPromises();
  await button(w, "加入并返回视频编辑").trigger("click");
  await flushPromises();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(w.text()).toContain("回收站");
});
it("explains bitrate and removes the standalone library hyperlink", async () => {
  const w = await setup();
  expect(w.text()).not.toContain("打开音频素材库");
  expect(w.text()).toContain("提高码率不能恢复原音频已丢失的细节");
  expect(
    w
      .findAllComponents(NSelect)
      .find((s) => s.attributes("aria-label") === "MP3 码率")!
      .props("options")
  ).toContainEqual({ value: 192, label: "192 kbps · 均衡（推荐）" });
});
async function openBulk(w: VueWrapper, pages = 2) {
  await selectPage(w);
  for (let page = 2; page <= pages; page++) {
    w.getComponent(NPagination).vm.$emit("update:page", page);
    await flushPromises();
    await selectPage(w);
  }
  await button(w, "加入所选到音频素材库").trigger("click");
  await flushPromises();
}
it("adds the cross-page selection serially with one group/purpose snapshot and does not choose an arbitrary editor track", async () => {
  const w = await setup();
  await openBulk(w);
  expect(w.text()).toContain("已选 2 条");
  w.findAllComponents(NSelect)
    .find((s) => s.attributes("aria-label") === "目标分组")!
    .vm.$emit("update:value", "group123");
  w.findAllComponents(NSelect)
    .find((s) => s.attributes("aria-label") === "用途")!
    .vm.$emit("update:value", "general");
  await flushPromises();
  await button(w, "加入素材库").trigger("click");
  await flushPromises();
  expect(mocks.add.mock.calls).toEqual([
    ["converted123", "group123", "general"],
    ["another456", "group123", "general"]
  ]);
  expect(w.text()).toContain("新增 2 条，已存在 0 条，失败 0 条");
  expect(w.text()).toContain("已选 0 条");
  expect(mocks.push).not.toHaveBeenCalled();
});
it("keeps only failed items selected and retries only those items", async () => {
  mocks.add
    .mockResolvedValueOnce({ item: { id: "already" }, existing: true })
    .mockRejectedValueOnce(new Error("injected failure"));
  const w = await setup();
  await openBulk(w);
  await button(w, "加入素材库").trigger("click");
  await flushPromises();
  expect(w.text()).toContain("新增 0 条，已存在 1 条，失败 1 条");
  expect(w.text()).toContain("已选 1 条");
  await button(w, "重试未加入项").trigger("click");
  await flushPromises();
  expect(mocks.add.mock.calls.map((call) => call[0])).toEqual(["converted123", "another456", "another456"]);
  expect(w.text()).toContain("已选 0 条");
});
it("supports 1000 selections without parallel library writes", async () => {
  const ids = Array.from({ length: 1000 }, (_, i) => `converted${i}`);
  mocks.list.mockImplementation(async (page: number) => ({
    items: page === 21 ? [{ ...job("remaining"), status: "pending" }] : ids.slice((page - 1) * 50, page * 50).map(job),
    total: 1001
  }));
  let active = 0,
    peak = 0;
  mocks.add.mockImplementation(async (id: string) => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    return { item: { id }, existing: false };
  });
  // Keep the 20-page selection and serial writes real; omit decorative control internals in this volume case.
  const w = await setup(true);
  await openBulk(w, 20);
  expect(w.text()).toContain("已选 1000 条");
  expect(w.text()).toContain("共 1001 条");
  // Leave the last partial page visible while adding the 1000 selected results from the preceding pages.
  w.getComponent(NPagination).vm.$emit("update:page", 21);
  await flushPromises();
  await button(w, "加入素材库").trigger("click");
  await flushPromises();
  expect(mocks.add).toHaveBeenCalledTimes(1000);
  expect(peak).toBe(1);
  expect(w.text()).toContain("新增 1000 条，已存在 0 条，失败 0 条");
  // This case exercises 20 page transitions and 1000 reactive import updates, not one selection response.
}, 20000);
it("stops subsequent additions on disposal while preserving the accepted addition", async () => {
  let finish!: (value: { item: { id: string }; existing: boolean }) => void;
  mocks.add.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const w = await setup();
  await openBulk(w);
  await button(w, "加入素材库").trigger("click");
  await flushPromises();
  expect(mocks.add).toHaveBeenCalledTimes(1);
  w.unmount();
  wrapper = undefined;
  finish({ item: { id: "accepted" }, existing: false });
  await flushPromises();
  expect(mocks.add).toHaveBeenCalledTimes(1);
  expect(mocks.push).not.toHaveBeenCalled();
});
