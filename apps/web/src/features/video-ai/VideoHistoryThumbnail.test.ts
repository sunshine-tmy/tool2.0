// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VideoHistoryThumbnail from "./VideoHistoryThumbnail.vue";

const wrappers: ReturnType<typeof mount>[] = [];
const observers: {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(public callback: IntersectionObserverCallback) {
        observers.push(this);
      }
    }
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  observers.splice(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup(src: string | undefined = "/output/task?preview=1") {
  const w = mount(VideoHistoryThumbnail, { props: { src, name: "clip.mp4" } });
  wrappers.push(w);
  return w;
}
async function intersect(w: ReturnType<typeof mount>, index = 0) {
  observers[index].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  await w.vm.$nextTick();
}
function ready(element: Element) {
  Object.defineProperties(element, {
    readyState: { configurable: true, value: 2 },
    videoWidth: { configurable: true, value: 720 },
    videoHeight: { configurable: true, value: 1280 }
  });
}

it("loads only near the viewport, captures the first frame without playback and releases the decoder", async () => {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,ZnJhbWU=");
  const play = vi.spyOn(HTMLMediaElement.prototype, "play");
  const setTimer = vi.spyOn(globalThis, "setTimeout");
  const clearTimer = vi.spyOn(globalThis, "clearTimeout");
  const w = setup();
  expect(observers[0].observe).toHaveBeenCalledWith(w.element);
  expect(w.find("video").exists()).toBe(false);
  await intersect(w);
  const video = w.get("video");
  expect(video.attributes("src")).toBe("/output/task?preview=1");
  expect(video.attributes("autoplay")).toBeUndefined();
  expect((video.element as HTMLVideoElement).currentTime).toBe(0);
  ready(video.element);
  await video.trigger("loadeddata");
  expect(w.get("img").attributes("src")).toBe("data:image/jpeg;base64,ZnJhbWU=");
  expect(w.get("img").attributes("alt")).toBe("clip.mp4 首帧");
  expect(drawImage.mock.calls[0].slice(1)).toEqual([0, 0, 113, 200]);
  expect(w.find("video").exists()).toBe(false);
  expect(video.element.hasAttribute("src")).toBe(false);
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  expect(play).not.toHaveBeenCalled();
  const loadTimeout = setTimer.mock.calls.findIndex((call) => call[1] === 20_000);
  expect(loadTimeout).toBeGreaterThanOrEqual(0);
  expect(clearTimer).toHaveBeenCalledWith(setTimer.mock.results[loadTimeout].value);
  await w.get("button").trigger("click");
  expect(w.emitted("view")).toHaveLength(1);
});

it("does not load missing results and shows a useful fallback for video or canvas failures", async () => {
  const w = setup("");
  expect(w.text()).toContain("暂无预览");
  expect(observers).toHaveLength(0);
  await w.setProps({ src: "/output/new" });
  await intersect(w);
  await w.get("video").trigger("error");
  expect(w.text()).toContain("预览不可用");
  expect(w.find("video").exists()).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
  await w.setProps({ src: "/output/other" });
  await intersect(w, 1);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  ready(w.get("video").element);
  await w.get("video").trigger("loadeddata");
  expect(w.text()).toContain("预览不可用");
});

it("cancels stale loads on source changes and releases pending requests on unmount", async () => {
  const w = setup();
  await w.setProps({ src: "/output/other" });
  await intersect(w, 0);
  expect(w.find("video").exists()).toBe(false);
  await intersect(w, 1);
  const video = w.get("video");
  expect(video.attributes("src")).toBe("/output/other");
  w.unmount();
  expect(video.element.hasAttribute("src")).toBe(false);
  expect(observers[1].disconnect).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("times out stalled media and works without IntersectionObserver", async () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  const w = setup();
  await w.vm.$nextTick();
  expect(w.find("video").exists()).toBe(true);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(w.text()).toContain("预览不可用");
  expect(w.find("video").exists()).toBe(false);
});
