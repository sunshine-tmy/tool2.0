// @vitest-environment happy-dom
import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  defaultArchiveFrame,
  defaultArchiveWatermarkSettings,
  type ArchiveSubtitle,
  type ArchiveCutClip
} from "@toolbox/shared/archive";
import Picture from "./ArchiveCutPicture.vue";
import TransformBox from "./ArchiveTransformBox.vue";
let wrapper: VueWrapper, frames: Map<number, FrameRequestCallback>, serial: number;
beforeEach(() => {
  frames = new Map();
  serial = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const noop = () => undefined;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "",
    setTransform: noop,
    clearRect: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    fillRect: noop,
    drawImage: noop,
    strokeText: noop,
    fillText: noop,
    measureText: (text: string) => ({ width: text.length * 20 })
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 300,
    height: 300,
    right: 300,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({})
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function paint() {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(0);
  await nextTick();
}
const cue: ArchiveSubtitle = {
  id: "text_001",
  text: "文本",
  start: 0,
  end: 10,
  fontSize: 36,
  position: "center",
  color: "#ffffff",
  x: 0.4,
  y: 0.5,
  lane: 0
};
const clip: ArchiveCutClip = { id: "video_001", start: 0, end: 10, at: 0, lane: 1 };
async function open(text = true) {
  wrapper = shallowMount(Picture, {
    props: {
      frame: defaultArchiveFrame(),
      sourceWidth: 300,
      sourceHeight: 300,
      gap: true,
      clips: [{ ...clip, transform: { scaleX: 0.4, scaleY: 0.5 } }],
      subtitles: text ? [cue] : [],
      time: 0,
      ...(text ? { activeSubtitleId: cue.id } : { activeClipId: clip.id })
    }
  });
  await nextTick();
  await paint();
  return wrapper.getComponent(TransformBox);
}
const movement = (dx: number, dy = 0) => ({ dx, dy, sx: 1, sy: 1, angle: 0 });

it("snaps both text midlines, draws guides, and commits the snapped position only on release", async () => {
  const box = await open();
  box.vm.$emit("start", "move");
  box.vm.$emit("update", movement(28, 3));
  await nextTick();
  expect(wrapper.findAll(".preview-snap-guides line")).toHaveLength(2);
  expect(wrapper.find("line[x1='150'][x2='150']").exists()).toBe(true);
  expect(wrapper.find("line[y1='150'][y2='150']").exists()).toBe(true);
  expect(wrapper.emitted("subtitle")).toBeUndefined();
  box.vm.$emit("commit", movement(28, 3));
  await nextTick();
  expect(wrapper.emitted("subtitle")?.[0]).toEqual([cue.id, expect.objectContaining({ x: 0.5, y: 0.5 })]);
  expect(wrapper.find(".preview-snap-guides").exists()).toBe(false);
});

it("applies the same snapping when dragging the material directly on the canvas", async () => {
  await open();
  wrapper
    .get("canvas")
    .element.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 7, clientX: 120, clientY: 150, bubbles: true })
    );
  window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 7, clientX: 148, clientY: 153 }));
  await nextTick();
  expect(wrapper.findAll(".preview-snap-guides line")).toHaveLength(2);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, clientX: 148, clientY: 153 }));
  await nextTick();
  expect(wrapper.emitted("subtitle")?.[0]).toEqual([cue.id, expect.objectContaining({ x: 0.5, y: 0.5 })]);
  expect(wrapper.find(".preview-snap-guides").exists()).toBe(false);
});

it("allows an outside text edge to meet the canvas edge and clears guides when cancelled", async () => {
  const box = await open();
  box.vm.$emit("start", "move");
  box.vm.$emit("update", movement(197));
  await nextTick();
  expect(wrapper.find("line[x1='300'][x2='300']").exists()).toBe(true);
  box.vm.$emit("commit", movement(197));
  await nextTick();
  expect((wrapper.emitted("subtitle")?.[0][1] as Partial<ArchiveSubtitle>).x).toBeCloseTo(320 / 300);
  box.vm.$emit("start", "move");
  box.vm.$emit("update", movement(28));
  await nextTick();
  window.dispatchEvent(new Event("blur"));
  await nextTick();
  expect(wrapper.find(".preview-snap-guides").exists()).toBe(false);
  expect(wrapper.emitted("subtitle")).toHaveLength(1);
});

it("snaps video edges and keeps resize gestures free of move snapping", async () => {
  const box = await open(false);
  box.vm.$emit("start", "move");
  box.vm.$emit("update", movement(-92));
  await nextTick();
  expect(wrapper.find("line[x1='0'][x2='0']").exists()).toBe(true);
  box.vm.$emit("commit", movement(-92));
  await nextTick();
  expect(wrapper.emitted("clip")?.[0]).toEqual([
    clip.id,
    { transform: expect.objectContaining({ offsetX: -0.3, offsetY: 0 }) }
  ]);
  box.vm.$emit("start", "scale");
  box.vm.$emit("update", { ...movement(5), sx: 1.1 });
  await nextTick();
  expect(wrapper.find(".preview-snap-guides").exists()).toBe(false);
  box.vm.$emit("cancel");
});

it("水印预览与视频、文本共用拖拽吸附及变换框，松手一次提交，锁定后不可改", async () => {
  await open(false);
  const mark = {
    id: "mark_001",
    title: "水印",
    start: 0,
    end: 10,
    sourceStart: 0,
    lane: 0,
    asset: { kind: "saved" as const, id: "asset_001", width: 100, height: 50 },
    settings: {
      ...defaultArchiveWatermarkSettings(),
      widthPercent: 20,
      motion: { ...defaultArchiveWatermarkSettings().motion, type: "fixed" as const, from: { x: 0.4, y: 0.5 } }
    }
  };
  await wrapper.setProps({
    activeClipId: undefined,
    activeWatermarkId: mark.id,
    watermarks: [mark],
    clips: [{ ...clip, lane: 1 }]
  });
  await paint();
  const box = wrapper.getComponent(TransformBox);
  box.vm.$emit("start", "move");
  box.vm.$emit("update", movement(23, 2));
  await nextTick();
  expect(wrapper.find("line[x1='150'][x2='150']").exists()).toBe(true);
  expect(wrapper.emitted("watermark")).toBeUndefined();
  box.vm.$emit("commit", movement(23, 2));
  await nextTick();
  expect(wrapper.emitted("watermark")?.[0]).toEqual([mark.id, expect.objectContaining({ offsetX: 0.08, offsetY: 0 })]);
  await wrapper.setProps({ watermarks: [{ ...mark, locked: true }] });
  await paint();
  expect(wrapper.getComponent(TransformBox).props("disabled")).toBe(true);
  box.vm.$emit("start", "move");
  box.vm.$emit("commit", movement(20));
  expect(wrapper.emitted("watermark")).toHaveLength(1);
});

it("选中运动水印显示轨迹和关键位置，拖动时同步平移，播放与切换选择时隐藏", async () => {
  await open(false);
  const mark = {
    id: "mark_001",
    title: "水印",
    start: 0,
    end: 10,
    sourceStart: 0,
    lane: 0,
    asset: { kind: "saved" as const, id: "asset_001", width: 100, height: 50 },
    settings: {
      ...defaultArchiveWatermarkSettings(),
      motion: {
        ...defaultArchiveWatermarkSettings().motion,
        type: "linear" as const,
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 }
      }
    }
  };
  await wrapper.setProps({ activeClipId: undefined, activeWatermarkId: mark.id, watermarks: [mark] });
  await paint();
  expect(wrapper.get(".watermark-trajectory").attributes("viewBox")).toBe("0 0 300 300");
  expect(wrapper.findAll(".watermark-trajectory circle")).toHaveLength(2);
  const before = wrapper.get(".watermark-trajectory polyline").attributes("points");
  const box = wrapper.getComponent(TransformBox);
  box.vm.$emit("start", "move");
  box.vm.$emit("update", movement(30));
  await nextTick();
  expect(wrapper.get(".watermark-trajectory polyline").attributes("points")).not.toBe(before);
  box.vm.$emit("cancel");
  await nextTick();
  expect(wrapper.get(".watermark-trajectory polyline").attributes("points")).toBe(before);
  await wrapper.setProps({ playing: true });
  expect(wrapper.find(".watermark-trajectory").exists()).toBe(false);
  await wrapper.setProps({ playing: false, time: 15 });
  expect(wrapper.find(".watermark-trajectory").exists()).toBe(true);
  await wrapper.setProps({ activeWatermarkId: undefined });
  expect(wrapper.find(".watermark-trajectory").exists()).toBe(false);
});
