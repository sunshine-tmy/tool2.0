// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import Range from "./ArchiveMusicRange.vue";
vi.mock("../audio-library/integrations/music", () => ({
  ArchiveMusicWaveform: defineComponent({
    name: "ArchiveMusicWaveform",
    props: {
      url: String,
      duration: Number,
      position: Number,
      range: Array,
      fixedRangeDuration: Number,
      disabled: Boolean
    },
    emits: ["update:range", "seek", "preview"],
    template: "<div />"
  })
}));
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function open(musicDuration = 120, videoDuration = 22, start = 0) {
  wrapper = mount(Range, {
    props: {
      url: "/music.mp3",
      title: "配乐",
      musicDuration,
      videoDuration,
      start,
      disabled: false,
      loop: true,
      volume: 20
    }
  });
  return wrapper;
}
it("fixes the range to the video length and clamps dragging at the end of a track", async () => {
  const w = open(),
    wave = w.findComponent({ name: "ArchiveMusicWaveform" });
  expect(wave.props("range")).toEqual([0, 22]);
  expect(wave.props("fixedRangeDuration")).toBe(22);
  wave.vm.$emit("update:range", [110, 115]);
  await flushPromises();
  expect(w.emitted("update:start")?.at(-1)).toEqual([98]);
  await w.setProps({ start: 98 });
  expect(wave.props("range")).toEqual([98, 120]);
  wave.vm.$emit("update:range", [-10, 12]);
  expect(w.emitted("update:start")?.at(-1)).toEqual([0]);
});
it("uses the entire short track and explains loop versus original-audio remainder", async () => {
  const w = open(10, 22, 7);
  expect(w.getComponent({ name: "ArchiveMusicWaveform" }).props("range")).toEqual([0, 10]);
  expect(w.emitted("update:start")?.at(-1)).toEqual([0]);
  expect(w.text()).toContain("重复铺满视频");
  await w.setProps({ loop: false });
  expect(w.text()).toContain("音乐结束后保留视频原声");
});
it("loads saved-snapshot duration from metadata and ignores invalid durations", async () => {
  const w = open(0, 22, 14),
    audio = w.get("audio").element as HTMLAudioElement;
  Object.defineProperty(audio, "duration", { value: NaN, configurable: true });
  await w.get("audio").trigger("loadedmetadata");
  expect(w.findComponent({ name: "ArchiveMusicWaveform" }).exists()).toBe(false);
  Object.defineProperty(audio, "duration", { value: 120 });
  await w.get("audio").trigger("loadedmetadata");
  expect(w.getComponent({ name: "ArchiveMusicWaveform" }).props("range")).toEqual([14, 36]);
});
it("auditions only the selected range and releases timers on range changes and disposal", async () => {
  const w = open(120, 22, 14),
    audio = w.get("audio").element as HTMLAudioElement;
  w.getComponent({ name: "ArchiveMusicWaveform" }).vm.$emit("preview");
  await flushPromises();
  expect(audio.currentTime).toBe(14);
  expect(audio.volume).toBe(0.2);
  expect(w.text()).toContain("暂停配乐选段");
  await vi.advanceTimersByTimeAsync(22000);
  expect(w.text()).toContain("播放配乐选段");
  w.getComponent({ name: "ArchiveMusicWaveform" }).vm.$emit("preview");
  await flushPromises();
  await w.setProps({ start: 30 });
  expect(vi.getTimerCount()).toBe(0);
  w.getComponent({ name: "ArchiveMusicWaveform" }).vm.$emit("preview");
  await flushPromises();
  w.unmount();
  wrapper = undefined;
  expect(vi.getTimerCount()).toBe(0);
});
