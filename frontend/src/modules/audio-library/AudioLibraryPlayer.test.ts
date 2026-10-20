// @vitest-environment happy-dom
/** 模块内队列的双语对照与原有队列操作回归。 */
import { defineComponent } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioLibraryItemView } from "@toolbox/shared";
import { NInputNumber, NSelect, NSlider } from "naive-ui";
import AudioLibraryPlayer from "./AudioLibraryPlayer.vue";
import { audioLibraryPlayer as player } from "./player";
vi.mock("./api", () => ({
  audioLibraryApi: { resolve: vi.fn().mockResolvedValue([]) },
  formatDuration: (value: number) => String(value)
}));
const button = defineComponent({ template: '<button v-bind="$attrs"><slot/></button>' });
function item(
  id: string,
  chineseText = "欢迎来到直播间",
  foreignText = "Selamat datang ke siaran langsung"
): AudioLibraryItemView {
  return {
    id,
    title: `音频 ${id}`,
    revision: 1,
    language: "ms",
    foreignText,
    chineseText,
    note: "",
    groupId: null,
    fileName: "audio.wav",
    mimeType: "audio/wav",
    bytes: 1644,
    duration: 10,
    sha256: "a".repeat(64),
    source: { kind: "upload" },
    createdAt: "2026-10-18",
    updatedAt: "2026-10-18",
    audioUrl: `/audio/${id}`,
    available: true
  };
}
let wrapper: VueWrapper;
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  player.clear();
  player.mode = "sequence";
  player.gap = 1;
  player.setVolume(1);
});
afterEach(() => {
  wrapper?.unmount();
  player.clear();
  vi.restoreAllMocks();
  localStorage.clear();
});
async function open(items: AudioLibraryItemView[]) {
  player.add(items);
  wrapper = mount(AudioLibraryPlayer, { global: { stubs: { NButton: button, Button: button } } });
  await flushPromises();
  const toggle = wrapper.findAll("button").find((x) => /^队列 \d+$/.test(x.text()));
  await toggle!.trigger("click");
  await flushPromises();
}
describe("模块内临时队列", () => {
  it("单次播放时明确提示，并可主动继续队列", async () => {
    await open([item("one"), item("two")]);
    player.selectionOnly = true;
    await flushPromises();
    expect(wrapper.get(".library-player-heading strong").text()).toBe("单条播放 · 音频 one");
    const resume = vi.spyOn(player, "resumeQueue").mockResolvedValueOnce(undefined);
    const button = wrapper.findAll("button").find((node) => node.text() === "继续队列播放");
    expect(button).toBeTruthy();
    await button!.trigger("click");
    expect(resume).toHaveBeenCalledOnce();
  });
  it("样式调整后模式、间隔、音量和播放进度仍可操作，音量显示百分比", async () => {
    await open([item("one")]);
    expect(wrapper.find("select").exists()).toBe(false);
    expect(wrapper.find('input[type="range"]').exists()).toBe(false);
    wrapper.getComponent(NSelect).vm.$emit("update:value", "list");
    await flushPromises();
    expect(player.mode).toBe("list");
    await wrapper.get('input[aria-label="播放间隔（秒）"]').setValue("3.5");
    expect(player.gap).toBe(3.5);
    const sliders = wrapper.findAllComponents(NSlider);
    expect(sliders).toHaveLength(2);
    sliders[1].vm.$emit("update:value", 0.35);
    await flushPromises();
    expect(player.volume).toBe(0.35);
    expect(wrapper.get(".library-player-volume-value").text()).toBe("35%");
    expect(wrapper.get('[role="slider"][aria-label="音量"]').attributes("aria-valuetext")).toBe("35%");
    const seek = vi.spyOn(player, "seek");
    sliders[0].vm.$emit("update:value", 2.5);
    await flushPromises();
    expect(seek).toHaveBeenCalledWith(2.5);
    expect(player.position).toBe(2.5);
    expect(wrapper.get('[role="slider"][aria-label="播放进度"]').attributes("aria-valuenow")).toBe("2.5");
  });
  it("间隔输入清空和越界时保持有效值，递增按钮仍使用组件库", async () => {
    await open([item("one")]);
    const input = wrapper.getComponent(NInputNumber);
    input.vm.$emit("update:value", null);
    expect(player.gap).toBe(0);
    input.vm.$emit("update:value", 999);
    expect(player.gap).toBe(300);
    input.vm.$emit("update:value", -1);
    expect(player.gap).toBe(0);
    input.vm.$emit("update:value", Number.NaN);
    expect(player.gap).toBe(0);
  });
  it("标题、中外文对照正确，重复项与顺序保持不变", async () => {
    await open([item("one"), item("two"), item("one")]);
    const rows = wrapper.findAll(".library-queue-copy");
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.get("button").text())).toEqual(["1. 音频 one", "2. 音频 two", "3. 音频 one"]);
    expect(rows[0].get(".library-queue-chinese").text()).toBe("中文：欢迎来到直播间");
    expect(rows[0].get(".library-queue-foreign").text()).toBe("外语：Selamat datang ke siaran langsung");
  });
  it("缺中文明确提示，原文与标题相同时不重复展示", async () => {
    await open([{ ...item("one", "   "), title: "Selamat datang ke siaran langsung" }]);
    expect(wrapper.get(".library-queue-chinese").text()).toBe("中文：暂无中文译文");
    expect(wrapper.find(".library-queue-foreign").exists()).toBe(false);
  });
  it("临时队列标题仅定位，独立按钮单次播放，排序与移除仍可用", async () => {
    await open([item("one"), item("two")]);
    const select = vi.spyOn(player, "select");
    const play = vi.spyOn(player, "play");
    await wrapper.get(".library-queue-title").trigger("click");
    expect(select).toHaveBeenCalledWith(player.queue[0].entryId);
    expect(player.phase).toBe("paused");
    expect(play).not.toHaveBeenCalled();
    const playOnce = vi.spyOn(player, "playOnce").mockResolvedValueOnce(undefined);
    await wrapper.get(".library-queue-play-once").trigger("click");
    expect(playOnce).toHaveBeenCalledWith(player.queue[0].entryId);
    await wrapper
      .findAll(".library-queue-actions")[0]
      .findAll("button")
      .find((node) => node.text() === "下移")!
      .trigger("click");
    expect(player.queue.map((x) => x.item.id)).toEqual(["two", "one"]);
    await wrapper
      .findAll(".library-queue-actions")[0]
      .findAll("button")
      .find((node) => node.text() === "移除")!
      .trigger("click");
    expect(player.queue.map((x) => x.item.id)).toEqual(["one"]);
  });
});
