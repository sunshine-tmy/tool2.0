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
import { ApiRequestError } from "../../shared/http/http";

const confirm = vi.hoisted(() => vi.fn());
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => confirm }));
vi.mock("./content-api", () => ({ contentArchiveApi: { addFrame: vi.fn(), removeFrame: vi.fn() } }));

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
        ChevronRight: true,
        ArchiveAudioEditor: true
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

beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockReset().mockResolvedValue(true);
  vi.mocked(contentArchiveApi.removeFrame).mockReset().mockResolvedValue(archive);
});
it("原配乐独立试听下载且不占用视觉轮播位置，播放视频时停止音乐", async () => {
  const audio = {
    ...archive.media[0],
    id: "source_music123",
    kind: "audio" as const,
    title: "作品原曲",
    previewUrl: "/music.wav",
    downloadUrl: "/music.wav?download=1"
  };
  const item = {
    ...archiveWithFrame,
    media: [audio, ...archiveWithFrame.media],
    warnings: ["本次未获取到新配乐，已保留上次归档的原配乐"]
  };
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  const { wrapper } = mountGallery(item);
  expect(wrapper.findAll(".media-thumbs > button")).toHaveLength(2);
  expect(wrapper.get(".archive-soundtrack").text()).toContain("作品原曲");
  expect(wrapper.get(".archive-soundtrack audio").attributes("src")).toContain("/music.wav");
  expect(wrapper.get(".archive-soundtrack a").attributes("href")).toContain("download=1");
  expect(wrapper.text()).toContain("已保留上次归档的原配乐");
  await wrapper.setProps({ showWarnings: false });
  expect(wrapper.text()).not.toContain("已保留上次归档的原配乐");
  await wrapper.get(".media-stage video").trigger("play");
  expect(pause).toHaveBeenCalled();
  await wrapper.findAll(".media-thumbs > button")[1].trigger("click");
  expect(wrapper.find(".media-stage video").exists()).toBe(false);
  expect(wrapper.find(".archive-soundtrack audio").exists()).toBe(true);
  wrapper.unmount();
});
afterEach(() => vi.restoreAllMocks());

describe("归档媒体编辑入口", () => {
  it.each(["tiktok", "douyin", "local"] as const)(
    "%s 普通视频首次打开及切到封面后均复用归档封面，其他视频不借用该封面",
    async (platform) => {
      const cover = {
        ...archiveWithFrame.media[1]!,
        id: "cover-123",
        kind: "cover" as const,
        frameSourceMediaId: undefined,
        frameTimestampMs: undefined,
        previewUrl: "/cover.jpg"
      };
      const otherVideo = { ...archive.media[0]!, id: "live-456", kind: "live-photo" as const };
      const item = { ...archive, platform, coverMediaId: cover.id, media: [...archive.media, cover, otherVideo] };
      const { wrapper } = mountGallery(item);
      expect(wrapper.get(".media-stage video").attributes("poster")).toContain("/cover.jpg");
      expect(wrapper.get('[aria-label="预览媒体 1"] video').attributes("poster")).toContain("/cover.jpg");
      expect(wrapper.get('[aria-label="预览媒体 3"] video').attributes("poster")).toBeUndefined();
      await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
      expect(wrapper.get('[aria-label="预览媒体 1"] video').attributes("preload")).toBe("none");
      expect(wrapper.find('[aria-label="预览媒体 1"] .video-thumb-placeholder').exists()).toBe(false);
      expect(wrapper.get('[aria-label="预览媒体 1"] video').attributes("poster")).toContain("/cover.jpg");
      expect(wrapper.get('[aria-label="预览媒体 3"] video').attributes("preload")).toBe("none");
      wrapper.unmount();
      const reopened = mountGallery(item).wrapper;
      expect(reopened.get('[aria-label="预览媒体 1"] video').attributes("poster")).toContain("/cover.jpg");
      reopened.unmount();
    }
  );
  it("归档没有封面时复用主预览已解码画面，切换归档后不沿用旧画面", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,cHJldmlldw==");
    const { wrapper, video } = mountGallery(archiveWithFrame);
    setVideoState(video!, { readyState: 4, videoWidth: 720, videoHeight: 1280 });
    await wrapper.get(".media-stage video").trigger("loadeddata");
    await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
    expect(wrapper.get(".media-thumbs video").attributes("poster")).toBe("data:image/jpeg;base64,cHJldmlldw==");
    expect(wrapper.find(".video-thumb-placeholder").exists()).toBe(false);
    await wrapper.setProps({ item: { ...archiveWithFrame, id: "another-archive" } });
    expect(wrapper.get(".media-thumbs video").attributes("poster")).toBeUndefined();
    wrapper.unmount();
  });
  it("shows a slideshow cover on first open without preloading or playing the generated video", async () => {
    const image = {
      ...archiveWithFrame.media[1]!,
      id: "source_image123",
      frameSourceMediaId: undefined,
      frameTimestampMs: undefined
    };
    const generated = {
      ...archive.media[0],
      id: "slideshow123",
      derivedFromImages: [{ id: image.id, checksum: image.checksum }]
    };
    const item: ContentArchiveItem = { ...archive, type: "image", media: [image, generated] };
    const { wrapper } = mountGallery(item);
    const thumb = () => wrapper.get('[aria-label="预览媒体 2"]');
    expect(thumb().get("video").attributes("poster")).toContain("/frame.png");
    expect(thumb().get("video").attributes("preload")).toBe("none");
    expect(thumb().find(".video-thumb-placeholder").exists()).toBe(false);
    await thumb().trigger("click");
    expect(wrapper.get(".media-stage video").attributes("poster")).toContain("/frame.png");
    wrapper.unmount();
    const reopened = mountGallery(item).wrapper;
    expect(reopened.get('[aria-label="预览媒体 2"] video').attributes("poster")).toContain("/frame.png");
    await reopened.setProps({ item: { ...item, media: [{ ...image, checksum: "c".repeat(64) }, generated] } });
    expect(reopened.get('[aria-label="预览媒体 2"] video').attributes("poster")).toBeUndefined();
    expect(reopened.find('[aria-label="预览媒体 2"] .video-thumb-placeholder').exists()).toBe(true);
    reopened.unmount();
  });
  it.each(["video", "live-photo"] as const)("%s 配乐和水印均派发页面跳转事件，不打开弹窗", async (kind) => {
    const { wrapper, video } = mountGallery({ ...archive, media: [{ ...archive.media[0]!, kind }] });
    const pause = vi.spyOn(video!, "pause").mockImplementation(() => {});
    const button = (label: string) => wrapper.findAll("button").find((entry) => entry.text() === label)!;
    await button("编辑配乐").trigger("click");
    expect(wrapper.emitted("editAudio")).toEqual([["video-123"]]);
    await button("添加水印").trigger("click");
    await button("添加水印").trigger("click");
    expect(wrapper.emitted("editWatermark")).toEqual([["video-123"], ["video-123"]]);
    expect(pause).toHaveBeenCalledTimes(3);
    expect(wrapper.findComponent({ name: "ArchiveAudioEditor" }).exists()).toBe(false);
    wrapper.unmount();
  });
  it("原始图集仍打开生成视频弹窗，截帧不提供生成入口", async () => {
    const image = { ...archiveWithFrame.media[1]!, frameSourceMediaId: undefined, frameTimestampMs: undefined };
    const { wrapper } = mountGallery({ ...archive, type: "image", media: [image] });
    const generate = wrapper.findAll("button").find((entry) => entry.text() === "图集生成视频")!;
    await generate.trigger("click");
    await flushPromises();
    expect(wrapper.findComponent({ name: "ArchiveAudioEditor" }).exists()).toBe(true);
    expect(wrapper.emitted("editAudio")).toBeUndefined();
    expect(wrapper.emitted("editWatermark")).toBeUndefined();
    wrapper.unmount();
    const frame = mountGallery({ ...archive, media: [archiveWithFrame.media[1]!] });
    expect(frame.wrapper.text()).not.toContain("图集生成视频");
    frame.wrapper.unmount();
  });
});

describe("XHS video frame capture", () => {
  it("选中截帧后确认删除并回到源视频，原始视频和图片不提供删除入口", async () => {
    const { wrapper } = mountGallery(archiveWithFrame);
    try {
      expect(wrapper.text()).not.toContain("删除截帧");
      await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
      const remove = wrapper.findAll("button").find((button) => button.text() === "删除截帧")!;
      await remove.trigger("click");
      await flushPromises();
      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining("原视频、其他媒体和截帧均保留"),
        expect.objectContaining({ title: "删除截帧" })
      );
      expect(contentArchiveApi.removeFrame).toHaveBeenCalledWith("archive-123", "frame-123", expect.any(AbortSignal));
      expect(wrapper.emitted("mediaUpdated")).toEqual([[archive]]);
      await wrapper.setProps({ item: archive });
      expect(wrapper.find(".media-stage video").exists()).toBe(true);
      expect(wrapper.findAll(".media-thumbs button")).toHaveLength(1);
      expect(wrapper.text()).not.toContain("删除截帧");
      const image = { ...archiveWithFrame.media[1]!, frameSourceMediaId: undefined, frameTimestampMs: undefined };
      await wrapper.setProps({ item: { ...archive, media: [image] } });
      expect(wrapper.text()).not.toContain("删除截帧");
    } finally {
      wrapper.unmount();
    }
  });
  it("取消删除不请求接口，删除失败保留当前截帧并可重试", async () => {
    const { wrapper } = mountGallery(archiveWithFrame);
    try {
      await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
      const remove = () => wrapper.findAll("button").find((button) => button.text() === "删除截帧")!;
      confirm.mockResolvedValueOnce(false);
      await remove().trigger("click");
      await flushPromises();
      expect(contentArchiveApi.removeFrame).not.toHaveBeenCalled();
      vi.mocked(contentArchiveApi.removeFrame).mockRejectedValueOnce(
        new ApiRequestError("文件正在使用", { code: "ARCHIVE_FRAME_BUSY", status: 409 })
      );
      await remove().trigger("click");
      await flushPromises();
      expect(wrapper.get('[role="status"]').text()).toContain("文件正在使用");
      expect(wrapper.find(".captured-frame-badge").exists()).toBe(true);
      expect(wrapper.emitted("mediaUpdated")).toBeUndefined();
      await remove().trigger("click");
      await flushPromises();
      expect(wrapper.emitted("mediaUpdated")).toEqual([[archive]]);
    } finally {
      wrapper.unmount();
    }
  });
  it("等待确认时切换媒体后不删除旧截帧", async () => {
    let finish!: (value: boolean) => void;
    confirm.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      })
    );
    const { wrapper } = mountGallery(archiveWithFrame);
    try {
      await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "删除截帧")!
        .trigger("click");
      await wrapper.get('[aria-label="预览媒体 1"]').trigger("click");
      finish(true);
      await flushPromises();
      expect(contentArchiveApi.removeFrame).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });
  it.each(["switch", "return", "unmount"])(
    "删除请求 %s 后迟到的结果不污染当前归档，且重复点击只提交一次",
    async (mode) => {
      let finish!: (value: ContentArchiveItem) => void;
      vi.mocked(contentArchiveApi.removeFrame).mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      );
      const { wrapper } = mountGallery(archiveWithFrame);
      await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
      const remove = wrapper.findAll("button").find((button) => button.text() === "删除截帧")!;
      await remove.trigger("click");
      await flushPromises();
      await remove.trigger("click");
      expect(contentArchiveApi.removeFrame).toHaveBeenCalledOnce();
      const signal = vi.mocked(contentArchiveApi.removeFrame).mock.calls[0]![2]!;
      if (mode === "unmount") wrapper.unmount();
      else {
        await wrapper.setProps({ item: { ...archive, id: "other-123" } });
        if (mode === "return") await wrapper.setProps({ item: archiveWithFrame });
      }
      finish(archive);
      await flushPromises();
      expect(wrapper.emitted("mediaUpdated")).toBeUndefined();
      if (mode === "unmount") expect(signal.aborted).toBe(true);
      else wrapper.unmount();
    }
  );
  it("删除期间选中其他保留媒体时，响应后仍显示该媒体", async () => {
    let finish!: (value: ContentArchiveItem) => void;
    const other = { ...archiveWithFrame.media[1]!, id: "frame-456", fileName: "other.png" };
    const updated = { ...archiveWithFrame, media: [archive.media[0]!, other] };
    vi.mocked(contentArchiveApi.removeFrame).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const { wrapper } = mountGallery({ ...archiveWithFrame, media: [...archiveWithFrame.media, other] });
    try {
      await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "删除截帧")!
        .trigger("click");
      await flushPromises();
      await wrapper.get('[aria-label="预览媒体 3"]').trigger("click");
      finish(updated);
      await flushPromises();
      await wrapper.setProps({ item: updated });
      expect(wrapper.get('[aria-label="预览媒体 2"]').classes()).toContain("active");
      expect(wrapper.find(".captured-frame-badge").exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });
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
  it.each(["xiaohongshu", "douyin"] as const)(
    "%s 切到截帧后保留视频缩略图，不再用占位遮住已加载画面",
    async (platform) => {
      const drawImage = vi.fn();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage
      } as unknown as CanvasRenderingContext2D);
      const toDataURL = vi
        .spyOn(HTMLCanvasElement.prototype, "toDataURL")
        .mockReturnValue("data:image/jpeg;base64,dGVzdA==");
      const { wrapper } = mountGallery({ ...archiveWithFrame, platform });
      const thumb = wrapper.get(".media-thumbs video");
      setVideoState(thumb.element as HTMLVideoElement, { readyState: 4, videoWidth: 1280, videoHeight: 720 });
      await thumb.trigger("loadeddata");
      expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.75);
      expect(drawImage.mock.calls[0]?.slice(1)).toEqual([0, 0, 160, 90]);

      await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
      expect(wrapper.find(".captured-frame-badge").exists()).toBe(true);
      expect(wrapper.get(".media-thumbs video").attributes("poster")).toBe("data:image/jpeg;base64,dGVzdA==");
      expect(wrapper.get(".media-thumbs video").attributes("preload")).toBe("none");
      expect(wrapper.find(".video-thumb-placeholder").exists()).toBe(false);
      expect(wrapper.findAll(".captured-frame-thumb-badge")).toHaveLength(1);

      // 新截帧回写归档时，同一视频版本的预览仍保留。
      await wrapper.setProps({ item: { ...archiveWithFrame, platform, updatedAt: "2026-10-20T23:00:00.000Z" } });
      expect(wrapper.get(".media-thumbs video").attributes("poster")).toContain("data:image/jpeg");
      await wrapper.get('[aria-label="预览媒体 1"]').trigger("click");
      expect(wrapper.find(".media-stage video").exists()).toBe(true);
      expect(wrapper.get(".media-stage video").attributes("autoplay")).toBeUndefined();
      wrapper.unmount();
    }
  );

  it("视频刷新或切换归档时清除旧缩略图，不借用另一条视频的截帧", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,dGVzdA==");
    const { wrapper } = mountGallery(archiveWithFrame);
    const thumb = wrapper.get(".media-thumbs video");
    setVideoState(thumb.element as HTMLVideoElement, { readyState: 4, videoWidth: 640, videoHeight: 360 });
    await thumb.trigger("seeked");
    await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
    const refreshed = {
      ...archiveWithFrame,
      media: [{ ...archive.media[0]!, checksum: "c".repeat(64) }, archiveWithFrame.media[1]!]
    };
    await wrapper.setProps({ item: refreshed });
    expect(wrapper.get(".media-thumbs video").attributes("poster")).toBeUndefined();
    expect(wrapper.find(".video-thumb-placeholder").exists()).toBe(true);
    expect(wrapper.get(".media-thumbs video").element).not.toBe(thumb.element);
    await wrapper.setProps({ item: { ...refreshed, id: "other-archive" } });
    expect(wrapper.find(".media-stage video").exists()).toBe(true);
    expect(wrapper.get(".media-thumbs video").attributes("poster")).toBeUndefined();
    wrapper.unmount();
  });

  it("无法导出缩略图时仍显示已解码视频，未加载的视频保留占位且不提前加载", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("canvas unavailable");
    });
    const otherVideo = { ...archive.media[0]!, id: "live-456", kind: "live-photo" as const };
    const { wrapper } = mountGallery({ ...archiveWithFrame, media: [...archiveWithFrame.media, otherVideo] });
    const thumb = wrapper.get(".media-thumbs video");
    setVideoState(thumb.element as HTMLVideoElement, { readyState: 2, videoWidth: 640, videoHeight: 360 });
    await thumb.trigger("loadeddata");
    await wrapper.get('[aria-label="预览媒体 2"]').trigger("click");
    expect(wrapper.get('[aria-label="预览媒体 1"]').find(".video-thumb-placeholder").exists()).toBe(false);
    expect(wrapper.get('[aria-label="预览媒体 3"]').find(".video-thumb-placeholder").exists()).toBe(true);
    expect(wrapper.get('[aria-label="预览媒体 3"] video').attributes("preload")).toBe("none");
    expect(contentArchiveApi.addFrame).not.toHaveBeenCalled();
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
