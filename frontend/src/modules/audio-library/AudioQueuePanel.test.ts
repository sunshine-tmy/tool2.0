// @vitest-environment happy-dom
/** 预设队列管理：明确替换、保持暂停、重复项顺序和安全删除。 */
import { defineComponent } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioLibraryItemView, AudioLibraryPreset } from "@toolbox/shared";
import AudioQueuePanel from "./AudioQueuePanel.vue";
import { audioLibraryApi as api } from "./api";
import { audioLibraryPlayer as player } from "./player";
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => mocks
}));
vi.mock("../../composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("./api", () => ({
  audioLibraryApi: { presets: vi.fn(), savePreset: vi.fn(), loadPreset: vi.fn(), deletePreset: vi.fn() },
  formatDuration: (x: number) => String(x)
}));
const pass = defineComponent({ template: '<div><slot/><slot name="footer"/></div>' }),
  button = defineComponent({ template: '<button v-bind="$attrs"><slot/></button>' }),
  modal = defineComponent({ props: { show: Boolean }, template: '<div v-if="show"><slot/></div>' }),
  input = defineComponent({
    props: { value: String },
    emits: ["update:value"],
    template: '<input :value="value" @input="$emit(\'update:value\',$event.target.value)"/>'
  });
const stubs = {
  NButton: button,
  Button: button,
  NCard: pass,
  Card: pass,
  NTabs: pass,
  Tabs: pass,
  NTabPane: pass,
  TabPane: pass,
  NSpin: pass,
  Spin: pass,
  NModal: modal,
  Modal: modal,
  NForm: pass,
  Form: pass,
  NFormItem: pass,
  FormItem: pass,
  NInput: input,
  Input: input,
  NSelect: true,
  Select: true,
  NInputNumber: true,
  InputNumber: true
};
function item(id: string): AudioLibraryItemView {
  return {
    id,
    title: id,
    revision: 1,
    language: "ms",
    foreignText: "Hello",
    chineseText: "你好",
    note: "",
    groupId: null,
    fileName: "audio.wav",
    mimeType: "audio/wav",
    bytes: 44,
    duration: 10,
    sha256: "a".repeat(64),
    source: { kind: "upload" },
    createdAt: "2026-10-18",
    updatedAt: "2026-10-18",
    audioUrl: `/audio/${id}`,
    available: true
  };
}
const preset: AudioLibraryPreset = {
  id: "preset_1",
  name: "开场",
  revision: 1,
  itemIds: ["two", "one", "two"],
  mode: "list",
  gap: 5,
  createdAt: "2026-10-18",
  updatedAt: "2026-10-18"
};
let wrapper: VueWrapper;
const click = async (name: string, container?: ReturnType<VueWrapper["find"]>) => {
  await flushPromises();
  const target = (container ?? wrapper).findAll("button").find((x) => x.text() === name);
  expect(target, `缺少按钮 ${name}`).toBeTruthy();
  await target!.trigger("click");
  await flushPromises();
};
beforeEach(() => {
  vi.clearAllMocks();
  player.clear();
  player.mode = "sequence";
  player.gap = 1;
  vi.mocked(api.presets).mockResolvedValue([{ ...preset }]);
  vi.mocked(api.loadPreset).mockResolvedValue({
    preset,
    items: [item("two"), item("one"), item("two")],
    unavailableCount: 0
  });
  mocks.confirm.mockResolvedValue(true);
  wrapper = mount(AudioQueuePanel, { global: { stubs } });
});
afterEach(() => {
  wrapper.unmount();
  player.clear();
  vi.restoreAllMocks();
});
describe("预设队列面板", () => {
  it("当前队列完整展示标题和双语，标题仅定位，右侧按钮单次播放", async () => {
    const title = "很长的直播标题，".repeat(12);
    const chineseText = "第一行中文译文\n" + "完整的中文说明。".repeat(30);
    const foreignText = "Selamat datang!\n" + "Full foreign language content. ".repeat(30);
    player.add([{ ...item("long"), title, chineseText, foreignText }]);
    await flushPromises();
    const row = wrapper.get(".audio-queue-entries li");
    expect(row.get(".audio-queue-entry-title").text()).toBe(`标题：${title}`);
    expect(row.get(".audio-queue-entry-chinese").text()).toBe(`中文：${chineseText}`);
    expect(row.get(".audio-queue-entry-foreign").text()).toBe(`外语：${foreignText.trim()}`);
    const select = vi.spyOn(player, "select");
    const play = vi.spyOn(player, "play");
    await row.get(".audio-queue-entry-title").trigger("click");
    expect(select).toHaveBeenCalledWith(player.queue[0].entryId);
    expect(player.currentId).toBe(player.queue[0].entryId);
    expect(player.phase).toBe("paused");
    expect(play).not.toHaveBeenCalled();
    const playOnce = vi.spyOn(player, "playOnce").mockResolvedValueOnce(undefined);
    await row.get(".audio-queue-play-once").trigger("click");
    expect(playOnce).toHaveBeenCalledWith(player.queue[0].entryId);
    expect(row.findAll(".audio-queue-row-actions button").map((button) => button.text())).toEqual([
      "单次播放",
      "上移",
      "下移",
      "移除"
    ]);
  });
  it("当前队列缺少文案时分别提示，标题与外语相同也保留外语行", async () => {
    player.add([
      { ...item("one"), chineseText: "   ", foreignText: "one" },
      { ...item("two"), chineseText: "中文", foreignText: "   " }
    ]);
    await flushPromises();
    const rows = wrapper.findAll(".audio-queue-entries li");
    expect(rows[0].get(".audio-queue-entry-chinese").text()).toBe("中文：暂无中文译文");
    expect(rows[0].get(".audio-queue-entry-foreign").text()).toBe("外语：one");
    expect(rows[1].get(".audio-queue-entry-chinese").text()).toBe("中文：中文");
    expect(rows[1].get(".audio-queue-entry-foreign").text()).toBe("外语：暂无外语文案");
  });
  it("预设介绍展示标题、中外文对照，保留顺序与重复项", async () => {
    await flushPromises();
    await click("查看内容", wrapper.find(".audio-preset"));
    const rows = wrapper.findAll(".audio-preset-contents li");
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.get(".audio-preset-item-title").text())).toEqual(["two", "one", "two"]);
    expect(rows[0].get(".audio-preset-chinese").text()).toBe("中文：你好");
    expect(rows[0].get(".audio-preset-foreign").text()).toBe("外语：Hello");
  });
  it("缺中文不伪装成译文，失效音频继续提示跳过", async () => {
    await flushPromises();
    vi.mocked(api.loadPreset).mockResolvedValueOnce({
      preset,
      items: [{ ...item("two"), chineseText: "   ", foreignText: "Selamat datang" }],
      unavailableCount: 1
    });
    await click("查看内容", wrapper.find(".audio-preset"));
    const rows = wrapper.findAll(".audio-preset-contents li");
    expect(rows[0].get(".audio-preset-chinese").text()).toBe("中文：暂无中文译文");
    expect(rows[0].get(".audio-preset-foreign").text()).toBe("外语：Selamat datang");
    expect(rows[1].text()).toContain("加载时跳过");
  });
  it("加载先确认替换，顺序/重复项与设置一致，保持暂停不自动播放", async () => {
    await flushPromises();
    player.add([item("old")]);
    const play = vi.spyOn(player, "play");
    await click("加载队列", wrapper.find(".audio-preset"));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("替换当前队列"), expect.anything());
    expect(player.queue.map((x) => x.item.id)).toEqual(["two", "one", "two"]);
    expect(player.mode).toBe("list");
    expect(player.gap).toBe(5);
    expect(player.phase).toBe("paused");
    expect(play).not.toHaveBeenCalled();
  });
  it("取消加载或预设全失效时保留当前队列，部分失效明确提示", async () => {
    await flushPromises();
    player.add([item("old")]);
    mocks.confirm.mockResolvedValueOnce(false);
    await click("加载队列", wrapper.find(".audio-preset"));
    expect(player.current?.id).toBe("old");
    vi.mocked(api.loadPreset).mockResolvedValueOnce({ preset, items: [], unavailableCount: 3 });
    await click("加载队列", wrapper.find(".audio-preset"));
    expect(player.current?.id).toBe("old");
    expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining("当前队列未改变"));
    vi.mocked(api.loadPreset).mockResolvedValueOnce({ preset, items: [item("two")], unavailableCount: 2 });
    await click("加载队列", wrapper.find(".audio-preset"));
    expect(player.queue).toHaveLength(1);
    expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining("跳过 2 条"));
  });
  it("保存当前队列只发送有序引用与设置；删除预设不清空队列", async () => {
    await flushPromises();
    player.add([item("one"), item("two"), item("one")]);
    player.mode = "single";
    player.gap = 8;
    await click("保存当前队列为预设");
    await wrapper.get('input[placeholder="例如：马来语开场 / 晚场促销"]').setValue("夜场");
    vi.mocked(api.savePreset).mockResolvedValue({ ...preset, name: "夜场" });
    await click("确认保存");
    expect(api.savePreset).toHaveBeenCalledWith(
      { name: "夜场", itemIds: ["one", "two", "one"], mode: "single", gap: 8, revision: undefined },
      undefined
    );
    const ids = player.queue.map((x) => x.entryId);
    await click("删除预设", wrapper.find(".audio-preset"));
    expect(api.deletePreset).toHaveBeenCalledWith("preset_1", 1);
    expect(player.queue.map((x) => x.entryId)).toEqual(ids);
  });
  it("重命名保留原内容；更新预设采用当前队列并发送版本防覆盖", async () => {
    await flushPromises();
    player.add([item("new")]);
    await click("重命名", wrapper.find(".audio-preset"));
    await wrapper.get('input[placeholder="例如：马来语开场 / 晚场促销"]').setValue("新的开场");
    await click("确认保存");
    expect(api.savePreset).toHaveBeenLastCalledWith(
      { name: "新的开场", itemIds: preset.itemIds, mode: "list", gap: 5, revision: 1 },
      "preset_1"
    );
    await click("用当前队列更新", wrapper.find(".audio-preset"));
    await click("确认保存");
    expect(api.savePreset).toHaveBeenLastCalledWith(
      { name: "开场", itemIds: ["new"], mode: "sequence", gap: 1, revision: 1 },
      "preset_1"
    );
  });
});
