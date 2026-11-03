// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NButton, NCheckbox, NSelect } from "naive-ui";
import Page from "./page.vue";
const mock = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
  library: vi.fn(),
  groups: vi.fn(),
  confirm: vi.fn()
}));
vi.mock("./api", () => ({ audioExtractApi: { ...mock, media: (id: string) => `/audio/${id}` } }));
vi.mock("../audio-library/integrations/extraction", () => ({ extractionLibraryApi: { list: mock.groups } }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mock.confirm }));
vi.mock("vue-router", () => ({ onBeforeRouteLeave: vi.fn() }));
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mock.list.mockResolvedValue({
    items: ["a", "b"].map((id) => ({
      id,
      name: `${id}.mp4`,
      status: "completed",
      phase: "已完成",
      progress: 100,
      format: "mp3",
      bitrate: 192,
      extension: "mp3",
      bytes: 1234,
      track: { index: 1, codec: "aac", language: "eng", title: "", channels: 2, duration: 1 },
      createdAt: "2026-11-03T00:00:00Z"
    })),
    total: 2
  });
  mock.groups.mockResolvedValue({ groups: [{ id: "group", name: "背景音乐" }] });
  mock.remove.mockResolvedValue({ ok: true });
  mock.library.mockResolvedValue({ item: { id: "new" }, existing: false });
  mock.confirm.mockResolvedValue(false);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
});
async function setup() {
  wrapper = mount(Page, {
    global: {
      stubs: {
        ToolLayout: { template: "<main><slot/></main>" },
        ToolPageHeader: true,
        NModal: { template: "<section><slot/></section>" }
      }
    }
  });
  await flushPromises();
  return wrapper;
}
async function click(text: string) {
  const b = wrapper!.findAllComponents(NButton).find((b) => b.text() === text);
  expect(b, text).toBeTruthy();
  await b!.trigger("click");
  await flushPromises();
}
async function togglePage(checked: boolean) {
  wrapper!
    .findAllComponents(NCheckbox)
    .find((c) => c.text() === "全选本页成功结果")!
    .vm.$emit("update:checked", checked);
  await flushPromises();
}
it("offers five containers, visible totals, original-copy mode and explicit MP3 quality", async () => {
  const w = await setup();
  expect(w.get("input[type=file]").attributes("accept")).toBe(".mp4,.mkv,.avi,.mov,.webm");
  expect(w.text()).toContain("共 2 条");
  expect(w.text()).toContain("2 GiB");
  expect(w.text()).toContain("原视频");
  expect(
    w.findAllComponents(NSelect).some((s) => s.props("options")?.some((o) => "value" in o && o.value === "original"))
  ).toBe(true);
});
it("confirms deletion and retains failed selections after partial batch deletion", async () => {
  await setup();
  await togglePage(true);
  await click("删除所选");
  expect(mock.remove).not.toHaveBeenCalled();
  mock.confirm.mockResolvedValue(true);
  mock.remove.mockRejectedValueOnce(Error("in use"));
  await click("删除所选");
  expect(mock.remove.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  expect(wrapper!.text()).toContain("已选 1 条");
  expect(wrapper!.text()).toContain("1 条删除失败");
});
it("adds all selected results with explicit library options and retries only unsuccessful items", async () => {
  await setup();
  await togglePage(true);
  await click("所选加入素材库");
  mock.library.mockResolvedValueOnce({ item: { id: "a" }, existing: false }).mockRejectedValueOnce(Error("space"));
  await click("加入素材库");
  expect(mock.library.mock.calls[0]).toEqual(["a", null, "music", false]);
  expect(wrapper!.text() + (document.body.textContent ?? "")).toContain("失败 1 条");
  mock.library.mockResolvedValue({ item: { id: "b" }, existing: true });
  await click("重试未加入项");
  expect(mock.library.mock.calls.map((c) => c[0])).toEqual(["a", "b", "b"]);
});
it("removes the two redundant buttons and keeps page selection reversible", async () => {
  const w = await setup();
  expect(w.findAllComponents(NButton).map((b) => b.text())).not.toContain("全选全部成功结果");
  expect(w.findAllComponents(NButton).map((b) => b.text())).not.toContain("清空选择");
  await togglePage(true);
  expect(w.text()).toContain("已选 2 条");
  await togglePage(false);
  expect(w.text()).toContain("已选 0 条");
});
