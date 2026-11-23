// @vitest-environment happy-dom
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import Timeline from "./ArchiveCutTimeline.vue";
import { defaultArchiveStudio, defaultArchiveWatermarkSettings } from "@toolbox/shared/archive";
let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function timeline() {
  return (wrapper = mount(Timeline, {
    attachTo: document.body,
    props: {
      itemId: "item_0001",
      mediaId: "media_001",
      clips: [{ id: "clip_001", start: 0, end: 5, at: 0, lane: 0 }],
      selected: ["clip_001"],
      time: 2,
      duration: 5,
      sourceDuration: 5,
      fps: 30,
      zoom: 1,
      snapping: true,
      canTrim: true,
      canUndo: true,
      canRedo: false,
      disabled: false,
      sourceUrl: "/video.mp4",
      sourceHasAudio: false,
      canPaste: true
    },
    global: {
      stubs: {
        NButton: { template: "<button><slot /></button>" },
        ArchiveCutThumbnail: true,
        ArchiveTimelineAudio: true
      }
    }
  }));
}
function key(target: Element, value: string, modifier: "ctrlKey" | "metaKey") {
  const event = new KeyboardEvent("keydown", { key: value, [modifier]: true, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}
it.each(["ctrlKey", "metaKey"] as const)("%s+C/V 在时间轴触发复制和粘贴，取消原生默认动作", async (modifier) => {
  const view = timeline();
  expect(key(view.get(".cut-track").element, "c", modifier).defaultPrevented).toBe(true);
  await view.setProps({ selected: [] });
  expect(key(view.get(".cut-track").element, "v", modifier).defaultPrevented).toBe(true);
  expect(view.emitted("copy")).toHaveLength(1);
  expect(view.emitted("paste")).toHaveLength(1);
});
it("输入框保留原生复制粘贴，编辑禁用时不触发时间线快捷键", async () => {
  const view = timeline(),
    input = document.createElement("input");
  view.element.append(input);
  expect(key(input, "c", "ctrlKey").defaultPrevented).toBe(false);
  expect(key(input, "v", "ctrlKey").defaultPrevented).toBe(false);
  await view.setProps({ disabled: true });
  key(view.get(".cut-track").element, "c", "ctrlKey");
  key(view.get(".cut-track").element, "v", "ctrlKey");
  expect(view.emitted("copy")).toBeUndefined();
  expect(view.emitted("paste")).toBeUndefined();
});

it("最低可滚动高度容纳两条完整视频，并向布局同步包含工具栏的总高度", async () => {
  const view = timeline();
  await view.setProps({
    clips: [
      { id: "clip_001", start: 0, end: 5, at: 0, lane: 0 },
      { id: "clip_002", start: 0, end: 5, at: 0, lane: 1 }
    ]
  });
  expect(view.get(".cut-scroll").attributes("style")).toContain("min-height: 212px");
  expect(view.get(".cut-timeline").attributes("style")).toContain("--timeline-min-height: 308px");
  expect(view.emitted("minimum-height")?.at(-1)).toEqual([308]);
});
it("水印和视频混排按实际素材高度预留空间，不把所有轨道统一增高", async () => {
  const view = timeline();
  await view.setProps({
    clips: [{ id: "clip_001", start: 0, end: 5, at: 0, lane: 1 }],
    studio: {
      ...defaultArchiveStudio(),
      watermarks: [
        {
          id: "mark_001",
          title: "水印",
          start: 0,
          end: 5,
          sourceStart: 0,
          lane: 0,
          asset: { id: "asset_001", kind: "saved", width: 100, height: 50 },
          settings: defaultArchiveWatermarkSettings()
        }
      ]
    }
  });
  expect(view.get(".cut-scroll").attributes("style")).toContain("min-height: 160px");
  expect(view.emitted("minimum-height")?.at(-1)).toEqual([256]);
  expect(view.get(".cut-node.watermark").attributes("style")).toContain("height: 30px");
  expect(view.get(".cut-node.video").attributes("style")).toContain("height: 82px");
});

it("窄面板工具栏换行后重新测量占用，卸载时释放尺寸观察器", async () => {
  let measure: (() => void) | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        measure = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
  );
  const view = timeline();
  let toolbarHeight = 92;
  Object.defineProperty(view.get(".cut-toolbar").element, "offsetHeight", { get: () => toolbarHeight });
  Object.defineProperty(view.get(".cut-summary").element, "offsetHeight", { get: () => 36 });
  measure!();
  await view.vm.$nextTick();
  const minimum = () =>
    Number.parseFloat(
      (view.get(".cut-timeline").element as HTMLElement).style.getPropertyValue("--timeline-min-height")
    );
  const contentMinimum = Number.parseFloat((view.get(".cut-scroll").element as HTMLElement).style.minHeight);
  expect(minimum()).toBeGreaterThanOrEqual(contentMinimum + 92 + 36);
  const before = minimum();
  toolbarHeight = 140;
  measure!();
  await view.vm.$nextTick();
  expect(minimum() - before).toBe(48);
  view.unmount();
  wrapper = undefined;
  expect(disconnect).toHaveBeenCalledOnce();
});
