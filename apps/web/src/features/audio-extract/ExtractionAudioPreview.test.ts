// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NButton, NSlider } from "naive-ui";
import Preview from "./ExtractionAudioPreview.vue";
vi.mock("../audio-library/integrations/extraction", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../audio-library/integrations/extraction")>();
  const { defineComponent } = await import("vue");
  return {
    ...actual,
    ExtractionAudioWaveform: defineComponent({
      name: "ExtractionAudioWaveform",
      props: { url: String, title: String, duration: Number, position: Number, editing: Boolean },
      emits: ["seek"],
      template: "<div />"
    })
  };
});
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
});
function open(props = {}) {
  wrapper = mount(Preview, { props: { url: "/audio/one", title: "视频.mp4", duration: 29, bytes: 684000, ...props } });
  return wrapper;
}
async function click(text: string) {
  const button = wrapper!.findAllComponents(NButton).find((b) => b.attributes("aria-label") === text);
  expect(button, text).toBeTruthy();
  await button!.trigger("click");
  await flushPromises();
}
function wave() {
  return wrapper!.getComponent({ name: "ExtractionAudioWaveform" });
}
function media() {
  return wrapper!.get("audio").element as HTMLAudioElement;
}
async function metadata(duration: number) {
  Object.defineProperties(media(), {
    duration: { value: duration, configurable: true },
    readyState: { value: 1, configurable: true }
  });
  await wrapper!.get("audio").trigger("loadedmetadata");
}
it("uses the real-waveform port and actual media controls with metadata, seeking, volume and pause", async () => {
  const w = open();
  expect(w.get("audio").attributes("controls")).toBeUndefined();
  expect(wave().props()).toMatchObject({ url: "/audio/one", duration: 29, position: 0, editing: false });
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  wave().vm.$emit("seek", 12);
  await metadata(29.14);
  expect(media().currentTime).toBe(12);
  expect(wave().props("duration")).toBe(29.14);
  await click("播放");
  expect(w.find('[aria-label="暂停"]').exists()).toBe(true);
  media().currentTime = 17;
  await w.get("audio").trigger("timeupdate");
  expect(wave().props("position")).toBe(17);
  expect(w.text()).toContain("0:17");
  wave().vm.$emit("seek", 100);
  await flushPromises();
  expect(media().currentTime).toBe(29.14);
  wave().vm.$emit("seek", NaN);
  expect(media().currentTime).toBe(29.14);
  w.getComponent(NSlider).vm.$emit("update:value", 0.3);
  await flushPromises();
  expect(media().volume).toBe(0.3);
  expect(w.get('[role="slider"]').attributes("aria-label")).toBe("试听音量");
  await w.get('[aria-label="静音"]').trigger("click");
  expect(media().volume).toBe(0);
  await w.get('[aria-label="取消静音"]').trigger("click");
  expect(media().volume).toBe(0.3);
  await click("暂停");
  await click("回到开头");
  expect(media().currentTime).toBe(0);
  expect(wave().props("position")).toBe(0);
});
it("streams long or large audio without decoding waveforms and keeps seeking available", async () => {
  const w = open({ duration: 7200 });
  expect(w.findComponent({ name: "ExtractionAudioWaveform" }).exists()).toBe(false);
  expect(w.text()).toContain("进度条试听");
  await metadata(7200);
  w.findAllComponents(NSlider)[0].vm.$emit("update:value", 3500);
  await flushPromises();
  expect(media().currentTime).toBe(3500);
  expect(w.get('[aria-label="试听播放位置"]').attributes("aria-valuetext")).toBe("58:20");
  await w.setProps({ duration: 29, url: "/large.wav", bytes: 101 * 1024 ** 2 });
  expect(w.findComponent({ name: "ExtractionAudioWaveform" }).exists()).toBe(false);
  await click("播放");
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
});
it("handles browser playback failure and permits retry without blocking download", async () => {
  const w = open();
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(Error("unsupported"));
  await click("播放");
  expect(w.get('[role="alert"]').text()).toContain("下载");
  await click("重试播放");
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledOnce();
  expect(w.find('[role="alert"]').exists()).toBe(false);
  await w.get("audio").trigger("pause");
  expect(w.find('[aria-label="暂停"]').exists()).toBe(false);
  await w.get("audio").trigger("error");
  expect(w.find('[role="alert"]').exists()).toBe(true);
});
it("cancels a pending play and rejects late playback after cancellation or unmount", async () => {
  const pending: Array<() => void> = [];
  vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(
    () => new Promise<void>((resolve) => pending.push(resolve))
  );
  const w = open(),
    audio = media();
  await click("播放");
  await click("取消加载");
  pending[0]();
  await flushPromises();
  expect(w.find('[aria-label="暂停"]').exists()).toBe(false);
  await click("播放");
  w.unmount();
  wrapper = undefined;
  expect(audio.hasAttribute("src")).toBe(false);
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledOnce();
  const calls = vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length;
  pending[1]();
  await flushPromises();
  expect(vi.mocked(HTMLMediaElement.prototype.pause).mock.calls.length).toBeGreaterThan(calls);
});
it("resets state when the source changes and reflects natural playback completion", async () => {
  const w = open();
  await metadata(30);
  await click("播放");
  media().currentTime = 30;
  await w.get("audio").trigger("timeupdate");
  await w.get("audio").trigger("ended");
  await click("播放");
  expect(media().currentTime).toBe(0);
  await w.setProps({ url: "/audio/two", duration: 15 });
  expect(wave().props()).toMatchObject({ duration: 15, position: 0 });
  expect(w.find('[aria-label="暂停"]').exists()).toBe(false);
  await metadata(Infinity);
  expect(wave().props("duration")).toBe(15);
});
