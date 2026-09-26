/**
 * 中文模块说明：验证小红书视频截帧的播放状态门禁、PNG 导出和保存反馈。
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { XhsArchiveItem } from "@toolbox/shared";
import MediaGallery from "./MediaGallery.vue";
import { xhsArchiveApi } from "./api";

vi.mock("./api", () => ({ xhsArchiveApi: { addFrame: vi.fn() } }));

const archive = {
  id: "archive-123",
  noteId: "note-123",
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
} as XhsArchiveItem;

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
} as XhsArchiveItem;

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

describe("XHS video frame capture", () => {
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
    } as XhsArchiveItem;
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
    expect(xhsArchiveApi.addFrame).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("saves the current timestamp as PNG and emits the updated archive", async () => {
    const { wrapper, video, button } = mountGallery();
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
    vi.mocked(xhsArchiveApi.addFrame).mockResolvedValue(archive);

    await button.trigger("click");
    await flushPromises();

    expect(xhsArchiveApi.addFrame).toHaveBeenCalledOnce();
    const [itemId, form] = vi.mocked(xhsArchiveApi.addFrame).mock.calls[0]!;
    expect(itemId).toBe(archive.id);
    expect(form.get("sourceMediaId")).toBe("video-123");
    expect(form.get("timestampMs")).toBe("12345");
    expect((form.get("file") as File).type).toBe("image/png");
    expect(wrapper.emitted("frameSaved")?.[0]?.[0]).toBe(archive);
    expect(wrapper.text()).toContain("已保存 00:00:12.345 的 PNG 截帧");
    wrapper.unmount();
  });
});
