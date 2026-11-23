// @vitest-environment happy-dom
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Audio, { type TimelineAudioValue } from "./ArchiveTimelineAudio.vue";
vi.mock("../audio-library/integrations/music", () => ({ loadArchiveMusicWaveform: vi.fn() }));
const wrappers: VueWrapper[] = [];
let frames: Map<number, FrameRequestCallback>, serial: number;
let contexts: WeakMap<HTMLCanvasElement, ReturnType<typeof context>>;
function context() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: "",
    globalCompositeOperation: "source-over"
  };
}
const waveform = () => ({ duration: 10, hasAudio: true, peaks: Float32Array.from([0.2, 0.8, 0.1, 0.6]) });
const audio = (): TimelineAudioValue => ({
  start: 0,
  end: 10,
  sourceStart: 0,
  speed: 1,
  volume: 100,
  fadeIn: 0,
  fadeOut: 0,
  loop: false
});
function paint() {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(0);
}
beforeEach(() => {
  frames = new Map();
  serial = 0;
  contexts = new WeakMap();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.set(++serial, fn);
    return serial;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
    }
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.callback([{ isIntersecting: true }]);
      }
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(32);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    if (!contexts.has(this)) contexts.set(this, context());
    return contexts.get(this) as unknown as CanvasRenderingContext2D;
  });
});
afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  wrappers.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function open(url: string, loader: (signal: AbortSignal) => Promise<ReturnType<typeof waveform>>) {
  const wrapper = mount(Audio, { props: { url, audio: audio(), disabled: false, loadWaveform: loader } });
  wrappers.push(wrapper);
  return wrapper;
}
it("调整视频声音与替换无修改的音频对象时，不重新请求任何素材波形或重置画布", async () => {
  const videoLoader = vi.fn(async () => waveform()),
    musicLoader = vi.fn(async () => waveform());
  const video = open("/video.mp4", videoLoader),
    music = open("/music.mp3", musicLoader);
  await flushPromises();
  paint();
  const videoCanvas = video.get("canvas").element as HTMLCanvasElement,
    musicCanvas = music.get("canvas").element as HTMLCanvasElement;
  const videoContext = contexts.get(videoCanvas)!,
    musicContext = contexts.get(musicCanvas)!;
  const videoDraws = videoContext.drawImage.mock.calls.length,
    musicDraws = musicContext.drawImage.mock.calls.length;
  const resize = vi.spyOn(HTMLCanvasElement.prototype, "width", "set");
  for (const change of [{ volume: 150 }, { fadeIn: 1.3 }, { fadeOut: 2.4 }]) {
    await video.setProps({ audio: { ...video.props("audio"), ...change } });
    await music.setProps({ audio: { ...music.props("audio") } });
    await flushPromises();
    paint();
  }
  expect(videoLoader).toHaveBeenCalledTimes(1);
  expect(musicLoader).toHaveBeenCalledTimes(1);
  expect(videoContext.drawImage.mock.calls.length).toBeGreaterThan(videoDraws);
  expect(musicContext.drawImage).toHaveBeenCalledTimes(musicDraws);
  expect(resize).not.toHaveBeenCalled();
  expect(video.text()).not.toContain("读取波形");
  expect(music.text()).not.toContain("重试波形");
});
it("首次读取尚未完成时连续调节参数不会取消或重复加载，切换源文件才重新读取", async () => {
  let resolve!: (value: ReturnType<typeof waveform>) => void;
  const loader = vi.fn(
    (_signal: AbortSignal) =>
      new Promise<ReturnType<typeof waveform>>((done) => {
        resolve = done;
      })
  );
  const wrapper = open("/one.mp4", loader);
  for (let i = 0; i < 12; i++)
    await wrapper.setProps({ audio: { ...wrapper.props("audio"), volume: 100 + i, fadeIn: i / 10 } });
  expect(loader).toHaveBeenCalledTimes(1);
  expect(loader.mock.calls[0][0].aborted).toBe(false);
  resolve(waveform());
  await flushPromises();
  paint();
  expect(wrapper.text()).not.toContain("读取波形");
  await wrapper.setProps({ url: "/two.mp4" });
  expect(loader).toHaveBeenCalledTimes(2);
  resolve(waveform());
  await flushPromises();
  paint();
  expect(wrapper.text()).not.toContain("重试波形");
});

it.each(["finish", "cancel"])("鼠标拖动 %s 后释放控制点焦点，不保留操作线的激活状态", async (mode) => {
  const wrapper = mount(Audio, {
    attachTo: document.body,
    props: { url: "/clip.mp3", audio: audio(), disabled: false, loadWaveform: async () => waveform() }
  });
  wrappers.push(wrapper);
  await flushPromises();
  paint();
  const handle = wrapper.get<HTMLButtonElement>(".fade-dot");
  Object.defineProperties(handle.element, {
    setPointerCapture: { value: vi.fn(), configurable: true },
    hasPointerCapture: { value: () => true, configurable: true },
    releasePointerCapture: { value: vi.fn(), configurable: true }
  });
  await handle.trigger("pointerdown", { button: 0, pointerId: 1, clientX: 20, clientY: 10 });
  expect(document.activeElement).toBe(handle.element);
  expect(wrapper.classes()).toContain("is-editing");
  if (mode === "finish") await handle.trigger("pointerup", { pointerId: 1, clientX: 20, clientY: 10 });
  else {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wrapper.vm.$nextTick();
  }
  expect(document.activeElement).not.toBe(handle.element);
  expect(wrapper.classes()).not.toContain("is-editing");
  expect(wrapper.emitted(mode === "finish" ? "commit" : "cancel")).toHaveLength(1);
});
