// @vitest-environment happy-dom
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NButton, NSelect } from "naive-ui";
import {
  defaultArchiveAudioSettings,
  defaultArchiveWatermarkSettings,
  type ArchiveVideoEditJob,
  type ContentArchiveItem
} from "@toolbox/shared";
import ArchiveAudioEditor from "./ArchiveAudioEditor.vue";
import ArchiveOutputSettings from "./ArchiveOutputSettings.vue";
import ArchiveMaterialPanel from "./ArchiveMaterialPanel.vue";
import ArchiveCutTimeline from "./ArchiveCutTimeline.vue";
import ArchiveWatermarkPreview from "./ArchiveWatermarkPreview.vue";
import ArchiveWatermarkSettings from "./ArchiveWatermarkSettings.vue";
const mocks = vi.hoisted(() => ({
  cutSource: vi.fn(),
  saveCutDraft: vi.fn(),
  interpolationRuntime: vi.fn(),
  runtime: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  uploadWatermark: vi.fn(),
  selectLibraryWatermark: vi.fn(),
  music: vi.fn(),
  upload: vi.fn(),
  detail: vi.fn(),
  musicItem: vi.fn(),
  confirm: vi.fn()
}));
vi.mock("./video-edit-api", () => ({ videoEditApi: mocks }));
vi.mock("../audio-library/integrations/music", () => ({
  archiveMusicLibraryApi: { list: mocks.music, upload: mocks.upload, item: mocks.musicItem }
}));
vi.mock("./content-api", () => ({ contentArchiveApi: { detail: mocks.detail } }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
const original: ContentArchiveItem = {
  id: "archive_music123",
  platform: "tiktok",
  contentId: "123",
  sourceUrl: "https://example.test",
  canonicalUrl: "https://example.test",
  type: "video",
  title: "视频",
  topics: [],
  media: [
    {
      id: "video_music123",
      kind: "video",
      index: 0,
      fileName: "video.mp4",
      mimeType: "video/mp4",
      size: 100,
      checksum: "a".repeat(64),
      durationMs: 2000,
      previewUrl: "/video",
      downloadUrl: "/video?download=1"
    }
  ],
  totalBytes: 100,
  status: "ready",
  warnings: [],
  fetchedAt: "2026-10-28",
  updatedAt: "2026-10-28"
};
const selectedMusic = {
  id: "music123",
  revision: 3,
  title: "配乐 A",
  available: true,
  duration: 5,
  audioUrl: "/music.mp3"
};
const pending: ArchiveVideoEditJob = {
  id: "edit_music123",
  itemId: original.id,
  mediaId: original.media[0].id,
  mode: "save",
  status: "running",
  stage: "rendering",
  progress: 20,
  message: "正在生成",
  createdAt: "2026-10-28",
  updatedAt: "2026-10-28"
};
let wrappers: VueWrapper[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  mocks.cutSource
    .mockReset()
    .mockResolvedValue({ duration: 2, fps: 30, width: 720, height: 1280, hasAudio: true, checksum: "a".repeat(64) });
  mocks.saveCutDraft.mockReset().mockResolvedValue(undefined);
  mocks.interpolationRuntime.mockReset().mockResolvedValue({ flowReady: true, rifeReady: true });
  mocks.runtime.mockReset().mockResolvedValue({ ready: true });
  mocks.list.mockReset().mockResolvedValue([]);
  mocks.music.mockReset().mockResolvedValue({ items: [selectedMusic], total: 1 });
  mocks.musicItem.mockReset().mockResolvedValue(selectedMusic);
  mocks.create
    .mockReset()
    .mockImplementation((_item, _media, input) => Promise.resolve({ ...pending, mode: input.mode }));
  mocks.get.mockReset().mockResolvedValue({ ...pending, status: "completed", progress: 100 });
  mocks.detail.mockReset().mockResolvedValue(original);
  mocks.confirm.mockReset().mockResolvedValue(true);
  mocks.cancel.mockReset().mockResolvedValue({ ...pending, status: "cancelled" });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 20 })
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  wrappers.forEach((w) => w.unmount());
  wrappers = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function setup(item = original, initialPanel?: "audio" | "watermark" | "cut") {
  const wrapper = mount(ArchiveAudioEditor, {
    props: { show: true, item, mediaId: item.media[0].id, initialPanel },
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" },
        teleport: true,
        NModal: { template: "<div><slot /></div>" },
        ArchiveMaterialPanel: true,
        ArchiveCutPicture: true,
        ArchiveCutTimeline: true,
        ArchiveCutSettings: true,
        ArchiveTextSettings: true,
        ArchiveWatermarkSettings: true,
        ArchiveOutputSettings: true,
        ArchiveMusicRange: { template: "<div />", methods: { stop() {} } }
      }
    }
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}
const button = (w: VueWrapper, label: string) => w.findAllComponents(NButton).find((b) => b.text() === label)!;
describe("统一视频工作台", () => {
  it.each([
    ["cut", "sources"],
    ["audio", "audio"],
    ["watermark", "watermark"]
  ] as const)("兼容旧 %s 入口，直接定位 %s 素材分类，不再保存切换模块", async (mode, tab) => {
    const w = await setup(original, mode);
    expect(w.find(".editor-mode-tabs").exists()).toBe(false);
    expect(w.getComponent(ArchiveMaterialPanel).props("initialTab")).toBe(tab);
    expect(w.getComponent(ArchiveCutTimeline).props("disabled")).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("文本、音乐和水印编辑共用草稿、时间线及一次最终保存", async () => {
    const w = await setup(),
      panel = w.getComponent(ArchiveMaterialPanel);
    panel.vm.$emit("texts", [
      { id: "text_001", text: "文字", start: 0, end: 2, fontSize: 36, color: "#ffffff", position: "center" }
    ]);
    await flushPromises();
    panel.vm.$emit("studio", {
      ...panel.props("studio"),
      musicTracks: [
        {
          id: "music_001",
          libraryItemId: selectedMusic.id,
          libraryRevision: 3,
          title: "音乐",
          start: 0,
          end: 2,
          sourceStart: 0,
          volume: 50,
          loop: false,
          fadeIn: 0,
          fadeOut: 0,
          lane: 2
        }
      ]
    });
    await flushPromises();
    panel.vm.$emit("watermark", { id: "draft_000001", width: 100, height: 50, previewUrl: "/draft.png" }, "品牌水印");
    await flushPromises();
    expect(w.getComponent(ArchiveWatermarkSettings).props("mark").title).toBe("品牌水印");
    expect(w.getComponent(ArchiveWatermarkPreview).props("asset")).toBeUndefined();
    expect(w.getComponent(ArchiveCutTimeline).props("studio")!.watermarks).toHaveLength(1);
    await button(w, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create).not.toHaveBeenCalled();
    w.getComponent(ArchiveOutputSettings).vm.$emit("start", { fps: 60 });
    await flushPromises();
    expect(mocks.saveCutDraft).toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const input = mocks.create.mock.lastCall![2];
    expect(input).toMatchObject({
      mode: "save",
      outputSettings: { fps: 60 },
      watermark: null,
      useSavedMusic: false,
      studio: {
        unified: true,
        subtitles: [{ text: "文字" }],
        musicTracks: [{ volume: 50 }],
        watermarks: [{ title: "品牌水印", asset: { kind: "draft", id: "draft_000001" } }]
      }
    });
    expect(input.musicId).toBeUndefined();
    expect(input.cut).toHaveLength(1);
  });
  it("最终输出设置取消不提交，未开启补帧不携带补帧配置", async () => {
    const w = await setup();
    await button(w, "导出视频").trigger("click");
    await flushPromises();
    const dialog = w.getComponent(ArchiveOutputSettings);
    expect(dialog.props("show")).toBe(true);
    dialog.vm.$emit("cancel");
    await flushPromises();
    expect(mocks.create).not.toHaveBeenCalled();
    await button(w, "保存为最新版本").trigger("click");
    dialog.vm.$emit("start", {});
    await flushPromises();
    expect(mocks.create.mock.lastCall![2].outputSettings).toEqual({});
  });
  it("打开旧工程把全局配乐和水印迁入轨道，使用归档快照地址", async () => {
    const item = structuredClone(original),
      file = { fileName: "old.mp4", mimeType: "video/mp4", size: 100, checksum: "b".repeat(64) };
    item.media[0].audioEdit = {
      revision: 1,
      original: file,
      settings: defaultArchiveAudioSettings(),
      music: { ...file, title: "旧配乐" },
      watermark: {
        file: { ...file, fileName: "logo.png", mimeType: "image/png" },
        width: 100,
        height: 50,
        settings: defaultArchiveWatermarkSettings()
      },
      updatedAt: "2026-11-23"
    };
    const w = await setup(item),
      timeline = w.getComponent(ArchiveCutTimeline);
    expect(timeline.props("studio")!.musicTracks).toHaveLength(1);
    expect(timeline.props("studio")!.watermarks).toHaveLength(1);
    expect(timeline.props("musicUrls")!.legacy_music_track).toContain("/saved-music");
    expect(timeline.props("watermarkUrls")!.legacy_watermark).toContain("/studio-watermarks/legacy_watermark");
    expect(w.getComponent(ArchiveWatermarkPreview).props("asset")).toBeUndefined();
  });
  it("音乐转换返回后插入音乐轨道，避免停留在已移除的全局配乐中", async () => {
    const w = await setup();
    await w.setProps({ show: false, initialMusicId: selectedMusic.id });
    await w.setProps({ show: true });
    await flushPromises();
    expect(w.getComponent(ArchiveCutTimeline).props("studio")!.musicTracks[0]).toMatchObject({
      libraryItemId: selectedMusic.id,
      fadeIn: 0,
      fadeOut: 0
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("关闭窗口只保留草稿并停止轮询，不取消后台任务", async () => {
    mocks.list.mockResolvedValue([pending]);
    mocks.get.mockResolvedValue(pending);
    const w = await setup();
    await button(w, "关闭窗口").trigger("click");
    await flushPromises();
    expect(w.emitted("update:show")?.[0]).toEqual([false]);
    expect(mocks.cancel).not.toHaveBeenCalled();
    await w.setProps({ show: false });
    const count = mocks.get.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(mocks.get).toHaveBeenCalledTimes(count);
  });
  it("恢复原片先确认，清除整个工程而非单独重置模块", async () => {
    const w = await setup();
    mocks.confirm.mockResolvedValueOnce(false);
    await button(w, "恢复原始视频").trigger("click");
    await flushPromises();
    expect(mocks.create).not.toHaveBeenCalled();
    await button(w, "恢复原始视频").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall![2].mode).toBe("restore");
  });
  it("运行时不可用时禁用保存", async () => {
    mocks.runtime.mockResolvedValue({ ready: false });
    const w = await setup();
    expect(button(w, "保存为最新版本").props("disabled")).toBe(true);
  });
  it("切换作品后丢弃旧的后台完成响应", async () => {
    mocks.list.mockResolvedValueOnce([pending]);
    let finish!: (job: ArchiveVideoEditJob) => void;
    mocks.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const w = await setup();
    await vi.advanceTimersByTimeAsync(800);
    await w.setProps({ item: { ...structuredClone(original), id: "archive_other123" } });
    await flushPromises();
    finish({ ...pending, status: "completed" });
    await flushPromises();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(w.emitted("saved")).toBeUndefined();
  });
  it("图集生成保留原配乐来源和 3:4 画幅选项", async () => {
    const item = structuredClone(original);
    item.type = "image";
    item.media[0].kind = "image";
    item.media.push({
      ...item.media[0],
      id: "source_music123",
      kind: "audio",
      mimeType: "audio/mpeg",
      checksum: "b".repeat(64)
    });
    const w = await setup(item);
    const select = w.findAllComponents(NSelect).find((entry) => entry.props("value") === "portrait")!;
    expect(select.props("options")!.some((option) => option.value === "portrait_3_4")).toBe(true);
    select.vm.$emit("update:value", "portrait_3_4");
    await button(w, "生成视频并归档").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall![2]).toMatchObject({
      sourceMusicId: "source_music123",
      slideshow: { aspect: "portrait_3_4", images: [{ id: item.media[0].id }] }
    });
  });
  it("图集生成完成只回传归档并关闭，不把生成弹窗切换为视频编辑器", async () => {
    const item = structuredClone(original);
    item.type = "image";
    item.media[0].kind = "image";
    const updated = structuredClone(item);
    updated.media.push({
      ...original.media[0],
      id: "generated_001",
      derivedFromImages: [{ id: item.media[0].id, checksum: item.media[0].checksum }]
    });
    mocks.detail.mockResolvedValue(updated);
    mocks.get.mockResolvedValue({ ...pending, status: "completed", resultMediaId: "generated_001" });
    const w = await setup(item);
    await button(w, "生成视频并归档").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(w.emitted("saved")?.[0]).toEqual([updated]);
    expect(w.emitted("update:show")?.at(-1)).toEqual([false]);
    expect(w.findComponent(ArchiveCutTimeline).exists()).toBe(false);
    expect(mocks.cutSource).not.toHaveBeenCalled();
  });
});
