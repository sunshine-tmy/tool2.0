/**
 * 中文模块说明：验证小红书视频截帧的播放状态门禁、PNG 导出和保存反馈。
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentArchiveItem } from "@toolbox/shared";
import MediaGallery from "./MediaGallery.vue";
import { contentArchiveApi } from "./content-api";

vi.mock("./content-api", () => ({ contentArchiveApi: { addFrame: vi.fn() } }));

const archive = {
  id: "archive-123",
  platform: "xiaohongshu" as const,
  contentId: "note-123",
  sourceUrl: "https://www.xiaohongshu.com/explore/note-123",
  canonicalUrl: "https://www.xiaohongshu.com/explore/note-123",
  type: "video",
  title: "截帧测试",
  topics: [],
  fetchedAt: "2026-09-26T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
  media: [
    {
      id: "video-123",
      kind: "video",
      index: 0,
      fileName: "video.mp4",
      mimeType: "video/mp4",
      size: 10,
      checksum: "a".repeat(64),
      previewUrl: "/video.mp4",
      downloadUrl: "/video.mp4?download=1"
    }
  ],
  status: "ready",
  warnings: [],
  totalBytes: 10
} as ContentArchiveItem;

const archiveWithFrame = {
  ...archive,
  media: [
    ...archive.media,
    {
      id: "frame-123",
      kind: "image",
      index: 0,
      fileName: "frame-001-0000001234.png",
      mimeType: "image/png",
      size: 128,
      width: 640,
      height: 360,
      frameSourceMediaId: "video-123",
      frameTimestampMs: 12_345,
      checksum: "b".repeat(64),
      previewUrl: "/frame.png",
      downloadUrl: "/frame.png?download=1"
    }
  ]
} as ContentArchiveItem;

const ButtonStub = defineComponent({
  props: { disabled: Boolean, loading: Boolean },
  template: '<button :disabled="disabled" :aria-busy="loading"><slot /></button>'
});

function mountGallery(item = archive) {
  const wrapper = mount(MediaGallery, {
    props: { item },
    global: {
      stubs: {
        NButton: ButtonStub,
        NImage: defineComponent({ template: "<img />" }),
        Camera: true,
        ChevronLeft: true,
        ChevronRight: true
      }
    }
  });
  const videoWrapper = wrapper.find(".media-stage video");
  const video = videoWrapper.exists() ? (videoWrapper.element as HTMLVideoElement) : undefined;
  if (video) {
    Object.defineProperties(video, {
      paused: { configurable: true, writable: true, value: true },
      readyState: { configurable: true, writable: true, value: 0 },
      videoWidth: { configurable: true, writable: true, value: 0 },
      videoHeight: { configurable: true, writable: true, value: 0 },
      currentTime: { configurable: true, writable: true, value: 12.345 }
    });
  }
  const button = wrapper.find(".frame-capture-actions button").exists()
    ? wrapper.get(".frame-capture-actions button")
    : wrapper.get(".media-thumbs button");
  return { wrapper, video, button };
}

function setVideoState(
  video: HTMLVideoElement,
  values: Partial<Record<"readyState" | "videoWidth" | "videoHeight", number>>
) {
  for (const [key, value] of Object.entries(values)) Object.defineProperty(video, key, { configurable: true, value });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("XHS video frame capture", () => {
  it("实况图集仅预加载所选视频，图片缩略图延迟加载", async () => {
    const item = {
      ...archiveWithFrame,
      media: [...archiveWithFrame.media, { ...archive.media[0]!, id: "live-456", kind: "live-photo" as const }]
    };
    const { wrapper } = mountGallery(item);
    expect(wrapper.findAll(".media-thumbs video").map((video) => video.attributes("preload"))).toEqual([
      "metadata",
      "none"
    ]);
    expect(wrapper.get(".media-thumbs img").attributes("loading")).toBe("lazy");
    expect(wrapper.findAll(".video-thumb-placeholder")).toHaveLength(1);
    expect(wrapper.get(".video-thumb-placeholder").text()).toBe("视频");
    await wrapper.get('[aria-label="预览媒体 3"]').trigger("click");
    expect(wrapper.findAll(".media-thumbs video").map((video) => video.attributes("preload"))).toEqual([
      "none",
      "metadata"
    ]);
    wrapper.unmount();
  });
  it("缩略视频显示首帧，上一张/下一张按顺序切换且不越界", async () => {
    const { wrapper } = mountGallery(archiveWithFrame);
    const thumbnail = wrapper.get(".media-thumbs video");
    Object.defineProperty(thumbnail.element, "duration", { configurable: true, value: 1 });
    await thumbnail.trigger("loadedmetadata");
    expect((thumbnail.element as HTMLVideoElement).currentTime).toBe(0.1);
    await thumbnail.trigger("loadedmetadata");
    expect((thumbnail.element as HTMLVideoElement).currentTime).toBe(0.1);
    await wrapper.get(".media-nav-next").trigger("click");
    expect(wrapper.find(".captured-frame-badge").exists()).toBe(true);
    await wrapper.get(".media-nav-prev").trigger("click");
    expect(wrapper.find(".media-stage video").exists()).toBe(true);
    wrapper.unmount();
  });
  it("marks captured frames in the top-right corner of the preview and thumbnail", async () => {
    const { wrapper } = mountGallery(archiveWithFrame);

    expect(wrapper.findAll(".captured-frame-thumb-badge")).toHaveLength(1);
    expect(wrapper.findAll(".captured-frame-badge")).toHaveLength(0);
    await wrapper.findAll(".media-thumbs > button")[1]?.trigger("click");
    expect(wrapper.findAll(".captured-frame-badge")).toHaveLength(1);
    expect(wrapper.get(".captured-frame-badge").text()).toContain("截帧");
    wrapper.unmount();
  });

  it("does not mark an ordinary image as a captured frame", () => {
    const regularImage = {
      ...archive,
      media: [
        {
          ...archive.media[0],
          kind: "image" as const,
          mimeType: "image/jpeg"
        }
      ]
    } as ContentArchiveItem;
    const { wrapper } = mountGallery(regularImage);

    expect(wrapper.findAll(".captured-frame-badge")).toHaveLength(0);
    expect(wrapper.findAll(".captured-frame-thumb-badge")).toHaveLength(0);
    wrapper.unmount();
  });

  it("requires a paused, decoded frame and reports canvas export failures", async () => {
    const { wrapper, video, button } = mountGallery();
    expect((button.element as HTMLButtonElement).disabled).toBe(true);

    setVideoState(video!, { readyState: 4, videoWidth: 640, videoHeight: 360 });
    await wrapper.get("video").trigger("loadeddata");
    expect((button.element as HTMLButtonElement).disabled).toBe(false);
    await wrapper.get("video").trigger("seeking");
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
    await wrapper.get("video").trigger("seeked");
    expect((button.element as HTMLButtonElement).disabled).toBe(false);

    await wrapper.get("video").trigger("play");
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
    await wrapper.get("video").trigger("pause");
    expect((button.element as HTMLButtonElement).disabled).toBe(false);

    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      if (tagName !== "canvas") return createElement(tagName, options);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: BlobCallback) => callback(null)
      } as unknown as HTMLCanvasElement;
    });

    await button.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("无法生成 PNG 截帧");
    expect(contentArchiveApi.addFrame).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each(["xiaohongshu", "douyin"] as const)("%s 暂停后保存 PNG，返回同平台归档", async (platform) => {
    const item = { ...archive, platform };
    const { wrapper, video, button } = mountGallery(item);
    setVideoState(video!, { readyState: 4, videoWidth: 1280, videoHeight: 720 });
    await wrapper.get("video").trigger("loadeddata");

    const png = new Blob(["png-data"], { type: "image/png" });
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      if (tagName !== "canvas") return createElement(tagName, options);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: BlobCallback) => callback(png)
      } as unknown as HTMLCanvasElement;
    });
    vi.mocked(contentArchiveApi.addFrame).mockResolvedValue(item);

    await button.trigger("click");
    await flushPromises();

    expect(contentArchiveApi.addFrame).toHaveBeenCalledOnce();
    const [itemId, form] = vi.mocked(contentArchiveApi.addFrame).mock.calls[0]!;
    expect(itemId).toBe(archive.id);
    expect(form.get("sourceMediaId")).toBe("video-123");
    expect(form.get("timestampMs")).toBe("12345");
    expect((form.get("file") as File).type).toBe("image/png");
    expect(wrapper.emitted("frameSaved")?.[0]?.[0]).toBe(item);
    expect(vi.mocked(contentArchiveApi.addFrame).mock.calls[0]![2]).toBeInstanceOf(AbortSignal);
    expect(wrapper.text()).toContain("已保存 00:00:12.345 的 PNG 截帧");
    wrapper.unmount();
  });

  it.each(["switch", "unmount", "refresh"] as const)("导出 PNG 时 %s，不把旧画面归档到新来源", async (mode) => {
    const { wrapper, video, button } = mountGallery();
    setVideoState(video!, { readyState: 4, videoWidth: 640, videoHeight: 360 });
    await wrapper.get("video").trigger("loadeddata");
    let exportPng!: BlobCallback;
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      if (tagName !== "canvas") return createElement(tagName, options);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: BlobCallback) => {
          exportPng = callback;
        }
      } as unknown as HTMLCanvasElement;
    });
    await button.trigger("click");
    if (mode === "unmount") wrapper.unmount();
    else
      await wrapper.setProps({
        item:
          mode === "switch"
            ? { ...archive, id: "other-123" }
            : { ...archive, media: [{ ...archive.media[0]!, checksum: "c".repeat(64) }] }
      });
    exportPng(new Blob(["png"], { type: "image/png" }));
    await flushPromises();
    expect(contentArchiveApi.addFrame).not.toHaveBeenCalled();
    expect(wrapper.emitted("frameSaved")).toBeUndefined();
    if (mode !== "unmount") wrapper.unmount();
  });
});
