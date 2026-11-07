// @vitest-environment happy-dom
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NButton, NSelect, NSlider, NPagination } from "naive-ui";
import {
  defaultArchiveAudioSettings,
  defaultArchiveWatermarkSettings,
  type ArchiveVideoEditJob,
  type ContentArchiveItem
} from "@toolbox/shared";
import ArchiveWatermarkControls from "./ArchiveWatermarkControls.vue";
import ArchiveAudioEditor from "./ArchiveAudioEditor.vue";
import ArchiveMusicRange from "./ArchiveMusicRange.vue";
import ArchiveWatermarkPreview from "./ArchiveWatermarkPreview.vue";
const mocks = vi.hoisted(() => ({
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
  mocks.runtime.mockReset().mockResolvedValue({ ready: true });
  mocks.list.mockReset().mockResolvedValue([]);
  mocks.music.mockReset().mockResolvedValue({ items: [selectedMusic], total: 1 });
  mocks.upload.mockReset().mockResolvedValue({ item: selectedMusic, existing: false });
  mocks.musicItem.mockReset().mockResolvedValue(selectedMusic);
  mocks.create
    .mockReset()
    .mockImplementation((_item, _media, input) => Promise.resolve({ ...pending, mode: input.mode }));
  mocks.get.mockReset().mockResolvedValue({ ...pending, status: "completed", progress: 100 });
  mocks.detail.mockReset().mockResolvedValue(original);
  mocks.confirm.mockReset().mockResolvedValue(true);
  mocks.cancel.mockReset().mockResolvedValue({ ...pending, status: "cancelled" });
  mocks.uploadWatermark.mockReset().mockResolvedValue({
    id: "watermark1234",
    width: 100,
    height: 50,
    previewUrl: "/draft.png",
    expiresAt: "2030-01-01"
  });
  mocks.selectLibraryWatermark.mockReset().mockImplementation(mocks.uploadWatermark);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  wrappers = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function setup(item = original, initialPanel?: "audio" | "watermark") {
  const wrapper = mount(ArchiveAudioEditor, {
    props: { show: true, item, mediaId: item.media[0].id, initialPanel },
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" },
        teleport: true,
        Modal: { template: "<div><slot /></div>" },
        NModal: { template: "<div><slot /></div>" },
        ArchiveMusicRange: defineComponent({
          name: "ArchiveMusicRange",
          props: {
            url: String,
            title: String,
            musicDuration: Number,
            videoDuration: Number,
            start: Number,
            disabled: Boolean,
            loop: Boolean,
            volume: Number
          },
          emits: ["update:start"],
          methods: { stop: () => undefined },
          template: "<div />"
        })
      }
    }
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}
function button(wrapper: VueWrapper, text: string) {
  return wrapper.findAllComponents(NButton).find((entry) => entry.text() === text)!;
}
describe("归档视频配乐编辑交互", () => {
  it("图集生成视频默认选用归档原配乐，提交身份与摘要，且不把音频加入图片序列", async () => {
    const item = structuredClone(original);
    item.type = "image";
    item.media[0].kind = "image";
    const source = {
      ...item.media[0],
      id: "source_music123",
      kind: "audio" as const,
      title: "原曲",
      mimeType: "audio/mpeg",
      previewUrl: "/source.mp3",
      checksum: "b".repeat(64),
      durationMs: 10000
    };
    item.media.push(source);
    const wrapper = await setup(item);
    const select = wrapper.findAllComponents(NSelect).find((entry) => entry.props("value") === "__original__")!;
    expect(select).toBeDefined();
    expect(wrapper.getComponent(ArchiveMusicRange).props()).toMatchObject({
      title: "原曲",
      musicDuration: undefined,
      videoDuration: 3
    });
    await button(wrapper, "生成视频并归档").trigger("click");
    await flushPromises();
    const request = mocks.create.mock.calls[0][2];
    expect(request).toMatchObject({
      sourceMusicId: source.id,
      sourceMusicChecksum: source.checksum,
      slideshow: { images: [{ id: item.media[0].id }] }
    });
    expect(request.musicId).toBeUndefined();
    expect(request.musicRevision).toBeUndefined();
    expect(request.useSavedMusic).toBe(false);
  });
  it("selects converted library music on return without saving the video automatically", async () => {
    const wrapper = await setup();
    await wrapper.setProps({ initialMusicId: selectedMusic.id, show: false });
    await wrapper.setProps({ show: true });
    await flushPromises();
    expect(mocks.musicItem).toHaveBeenCalledWith(selectedMusic.id);
    expect(wrapper.findAllComponents(NSelect).some((select) => select.props("value") === selectedMusic.id)).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("配乐选择分页展示服务端总数，并在搜索后更新总数及页码", async () => {
    mocks.music.mockResolvedValue({ items: [selectedMusic], total: 43 });
    const wrapper = await setup();
    expect(mocks.music).toHaveBeenCalledWith(expect.objectContaining({ view: "music" }), expect.any(AbortSignal));
    expect(wrapper.find('[aria-label="音乐库范围"]').exists()).toBe(false);
    expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 43 条");
    wrapper.getComponent(NPagination).vm.$emit("update:page", 2);
    await flushPromises();
    expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 43 条");
    expect(mocks.music).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: "music", page: 2 }),
      expect.any(AbortSignal)
    );
    mocks.music.mockResolvedValue({ items: [selectedMusic], total: 21 });
    await wrapper.get('input[placeholder="搜索音乐标题、备注"]').setValue("Tea");
    await button(wrapper, "搜索").trigger("click");
    await flushPromises();
    expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 21 条");
    expect(mocks.music).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: "music", keyword: "Tea", page: 1 }),
      expect.any(AbortSignal)
    );
  });
  it("编辑器上传的音频加入背景音乐，刷新仍使用相同分类", async () => {
    const wrapper = await setup();
    const file = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", { value: [file], configurable: true });
    await input.trigger("change");
    await flushPromises();
    expect(mocks.upload).toHaveBeenCalledWith(file, { purpose: "music" }, undefined, expect.any(AbortSignal));
    expect(mocks.music).toHaveBeenLastCalledWith(expect.objectContaining({ view: "music" }), expect.any(AbortSignal));
    expect(wrapper.findAllComponents(NSelect).some((select) => select.props("value") === selectedMusic.id)).toBe(true);
  });
  it("库素材选择失败保留当前水印，选择响应迟到不覆盖后来打开的作品", async () => {
    const wrapper = await setup();
    await button(wrapper, "水印设置").trigger("click");
    const controls = wrapper.getComponent(ArchiveWatermarkControls);
    controls.vm.$emit("upload", new File(["png"], "brand.png"));
    await flushPromises();
    mocks.selectLibraryWatermark.mockRejectedValueOnce(new Error("素材不可用"));
    controls.vm.$emit("selectLibrary", "abcdefghijkl");
    await flushPromises();
    expect(controls.props("asset")).toMatchObject({ draftId: "watermark1234" });
    let finish!: (value: unknown) => void;
    mocks.selectLibraryWatermark.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    controls.vm.$emit("selectLibrary", "abcdefghijkl");
    await flushPromises();
    await wrapper.setProps({ item: { ...structuredClone(original), id: "other_archive123" } });
    await flushPromises();
    finish({ id: "late_draft12", width: 20, height: 10, previewUrl: "/late.png" });
    await flushPromises();
    expect(wrapper.getComponent(ArchiveWatermarkControls).props("asset")).toBeUndefined();
  });
  it("从水印库选择只更换图片，保留透明度及轨迹并将独立草稿提交给保存任务", async () => {
    const wrapper = await setup();
    await button(wrapper, "水印设置").trigger("click");
    const controls = wrapper.getComponent(ArchiveWatermarkControls);
    const settings = defaultArchiveWatermarkSettings();
    settings.opacity = 35;
    settings.motion.type = "bounce";
    settings.motion.bounceStyle = "z";
    controls.vm.$emit("update:settings", settings);
    controls.vm.$emit("selectLibrary", "abcdefghijkl");
    await flushPromises();
    expect(mocks.selectLibraryWatermark).toHaveBeenCalledWith(
      original.id,
      original.media[0].id,
      "abcdefghijkl",
      expect.any(AbortSignal)
    );
    expect(controls.props("asset")).toMatchObject({ draftId: "watermark1234" });
    expect(controls.props("settings")).toMatchObject({ opacity: 35, motion: { type: "bounce", bounceStyle: "z" } });
    await button(wrapper, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({
      watermark: { draftId: "watermark1234", settings: { opacity: 35 } }
    });
  });
  it("上传水印并调透明度和轨迹，保存提交完整配方，移除水印保留已选音乐", async () => {
    const wrapper = await setup();
    await button(wrapper, "水印设置").trigger("click");
    const controls = wrapper.findComponent(ArchiveWatermarkControls);
    controls.vm.$emit("upload", new File(["png"], "logo.png", { type: "image/png" }));
    await flushPromises();
    expect(mocks.uploadWatermark).toHaveBeenCalledWith(
      original.id,
      original.media[0].id,
      expect.any(File),
      expect.any(AbortSignal)
    );
    const config = defaultArchiveWatermarkSettings();
    config.opacity = 35;
    config.motion.type = "ping-pong";
    controls.vm.$emit("update:settings", config);
    await flushPromises();
    await button(wrapper, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({
      watermark: { draftId: "watermark1234", settings: { opacity: 35, motion: { type: "ping-pong" } } }
    });
    await button(wrapper, "停止当前任务").trigger("click");
    await flushPromises();
    controls.vm.$emit("remove");
    await flushPromises();
    await button(wrapper, "配乐设置").trigger("click");
    wrapper
      .findAllComponents(NSelect)
      .find((entry) => entry.attributes("aria-label") === "选择背景音乐")!
      .vm.$emit("update:value", selectedMusic.id);
    await flushPromises();
    await button(wrapper, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({ musicId: selectedMusic.id, watermark: null });
  });
  it("重新打开水印快照，拒绝非法时间与未确认离开，上传迟到不污染新作品", async () => {
    const edited = structuredClone(original);
    edited.media[0].audioEdit = {
      revision: 1,
      original: { fileName: "video.mp4", mimeType: "video/mp4", size: 100, checksum: "a".repeat(64) },
      settings: defaultArchiveAudioSettings(),
      updatedAt: "2026-10-29",
      watermark: {
        file: { fileName: "watermark-a.png", mimeType: "image/png", size: 20, checksum: "b".repeat(64) },
        width: 100,
        height: 50,
        settings: defaultArchiveWatermarkSettings()
      }
    };
    const wrapper = await setup(edited);
    mocks.get.mockResolvedValueOnce({
      ...pending,
      mode: "preview",
      status: "completed",
      progress: 100,
      previewUrl: "/clean-watermark-base.mp4"
    });
    await button(wrapper, "水印设置").trigger("click");
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    const controls = wrapper.findComponent(ArchiveWatermarkControls);
    expect(controls.props("asset")?.url).toContain("/saved-watermark");
    controls.vm.$emit("update:settings", { ...defaultArchiveWatermarkSettings(), endSeconds: 0.5, startSeconds: 1 });
    await flushPromises();
    expect(button(wrapper, "保存为最新版本").props("disabled")).toBe(true);
    mocks.confirm.mockResolvedValueOnce(false);
    await button(wrapper, "关闭窗口").trigger("click");
    await flushPromises();
    expect(wrapper.emitted("update:show")).toBeUndefined();
    let resolve!: (value: unknown) => void;
    mocks.uploadWatermark.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    controls.vm.$emit("upload", new File(["png"], "logo.png"));
    await flushPromises();
    await wrapper.setProps({ item: { ...structuredClone(original), id: "other_archive123" } });
    await flushPromises();
    resolve({ id: "watermark1234", width: 20, height: 10, previewUrl: "/late.png" });
    await flushPromises();
    expect(wrapper.findComponent(ArchiveWatermarkControls).props("asset")).toBeUndefined();
  });
  it("图集按原图顺序提交生成参数，结果新增视频后可直接继续换配乐", async () => {
    const photos = structuredClone(original);
    photos.type = "image";
    photos.media[0].kind = "image";
    photos.media.push({ ...photos.media[0], id: "image_second123", index: 1 });
    const wrapper = await setup(photos);
    expect(wrapper.find('img[alt="图集原图预览"]').exists()).toBe(true);
    await button(wrapper, "生成视频并归档").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2].slideshow).toEqual({
      images: photos.media.map((media) => ({ id: media.id, checksum: media.checksum })),
      secondsPerImage: 3,
      aspect: "portrait"
    });
  });
  it("选择配乐并独立调原声音量，保存后刷新归档，再次保存使用快照和新版本", async () => {
    const wrapper = await setup();
    wrapper.findAllComponents(NSlider)[0].vm.$emit("update:value", 0);
    wrapper
      .findAllComponents(NSelect)
      .find((entry) => entry.attributes("aria-label") === "选择背景音乐")!
      .vm.$emit("update:value", selectedMusic.id);
    await button(wrapper, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create).toHaveBeenCalledWith(
      original.id,
      original.media[0].id,
      expect.objectContaining({
        mode: "save",
        revision: 0,
        checksum: "a".repeat(64),
        musicId: "music123",
        musicRevision: 3,
        settings: expect.objectContaining({ originalVolume: 0, musicVolume: 20 })
      }),
      expect.any(AbortSignal)
    );
    const saved = structuredClone(original);
    saved.media[0].checksum = "b".repeat(64);
    saved.media[0].previewUrl = `/latest.mp4?v=${saved.media[0].checksum}`;
    saved.media[0].audioEdit = {
      revision: 1,
      original: { fileName: "video.mp4", mimeType: "video/mp4", size: 100, checksum: "a".repeat(64) },
      music: { fileName: "music.mp3", mimeType: "audio/mpeg", size: 20, checksum: "c".repeat(64), title: "配乐 A" },
      settings: { ...defaultArchiveAudioSettings(), originalVolume: 0 },
      updatedAt: "2026-10-28"
    };
    mocks.detail.mockResolvedValueOnce(saved);
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(wrapper.emitted("saved")?.[0]).toEqual([saved]);
    await button(wrapper, "水印设置").trigger("click");
    await flushPromises();
    expect(wrapper.get("video").attributes("src")).toContain("/latest.mp4?v=");
    expect(wrapper.get("video").attributes("src")).not.toContain("/original");
    expect(wrapper.getComponent(ArchiveWatermarkPreview).props("active")).toBe(true);
    await button(wrapper, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create).toHaveBeenLastCalledWith(
      original.id,
      original.media[0].id,
      expect.objectContaining({ revision: 1, checksum: "b".repeat(64), useSavedMusic: true }),
      expect.any(AbortSignal)
    );
    expect(mocks.create.mock.lastCall?.[2]).not.toHaveProperty("musicId");
  });
  it("reopens a saved music version directly in watermark settings and keeps the same version when switching panels", async () => {
    const saved = structuredClone(original);
    saved.media[0].previewUrl = "/saved-with-music.mp4?v=revision2";
    saved.media[0].audioEdit = {
      revision: 2,
      original: { fileName: "original.mp4", mimeType: "video/mp4", size: 100, checksum: "a".repeat(64) },
      music: { fileName: "music.mp3", mimeType: "audio/mpeg", size: 20, checksum: "c".repeat(64), title: "音乐快照" },
      settings: { ...defaultArchiveAudioSettings(), originalVolume: 30, musicStartSeconds: 1 },
      updatedAt: "2026-11-01"
    };
    const w = await setup(saved, "watermark");
    const probe = w.get("[data-original-duration]");
    Object.defineProperty(probe.element, "duration", { value: 1.96 });
    await probe.trigger("loadedmetadata");
    w.getComponent(ArchiveWatermarkPreview).vm.$emit("duration", 2.05);
    await flushPromises();
    expect(w.getComponent(ArchiveWatermarkControls).props("duration")).toBe(1.96);
    expect(w.get("video").attributes("src")).toContain("/saved-with-music.mp4?v=revision2");
    await button(w, "配乐设置").trigger("click");
    await flushPromises();
    expect(w.getComponent(ArchiveMusicRange).props("url")).toContain(`/saved-music?v=${"c".repeat(64)}`);
    await button(w, "水印设置").trigger("click");
    await flushPromises();
    expect(w.get("video").attributes("src")).toContain("/saved-with-music.mp4?v=revision2");
    expect(mocks.create).not.toHaveBeenCalled();
    w.getComponent(ArchiveWatermarkControls).vm.$emit("upload", new File(["png"], "logo.png"));
    await flushPromises();
    await button(w, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({
      useSavedMusic: true,
      revision: 2,
      settings: { originalVolume: 30, musicStartSeconds: 1 },
      watermark: { settings: { endSeconds: null } }
    });
  });
  it("prepares a clean watermark canvas with the saved soundtrack, without baking in the old watermark or saving automatically", async () => {
    const saved = structuredClone(original);
    saved.media[0].audioEdit = {
      revision: 1,
      original: { fileName: "original.mp4", mimeType: "video/mp4", size: 100, checksum: "a".repeat(64) },
      music: { fileName: "music.mp3", mimeType: "audio/mpeg", size: 20, checksum: "c".repeat(64), title: "音乐快照" },
      settings: { ...defaultArchiveAudioSettings(), musicStartSeconds: 1 },
      watermark: {
        file: { fileName: "logo.png", mimeType: "image/png", size: 10, checksum: "d".repeat(64) },
        width: 100,
        height: 50,
        settings: defaultArchiveWatermarkSettings()
      },
      updatedAt: "2026-11-01"
    };
    mocks.get.mockResolvedValueOnce({
      ...pending,
      mode: "preview",
      status: "completed",
      progress: 100,
      previewUrl: "/clean-music-base.mp4"
    });
    const w = await setup(saved, "watermark");
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({
      mode: "preview",
      previewFullLength: true,
      watermark: null,
      useSavedMusic: true,
      settings: { musicStartSeconds: 1 }
    });
    await button(w, "配乐设置").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(w.get("video").attributes("src")).toContain("/video");
    await button(w, "水印设置").trigger("click");
    await flushPromises();
    expect(w.get("video").attributes("src")).toContain("/clean-music-base.mp4");
    expect(w.getComponent(ArchiveWatermarkPreview).props("active")).toBe(true);
    expect(w.emitted("saved")).toBeUndefined();
    await w.get("video").trigger("error");
    await flushPromises();
    expect(w.get("video").attributes("src")).toContain("/video");
    expect(button(w, "重试水印编辑画面").exists()).toBe(true);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await button(w, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({
      mode: "save",
      useSavedMusic: true,
      revision: 1,
      watermark: { settings: { opacity: 70 } }
    });
  });
  it("保存水印后父页面回写归档不会中断或重复创建无水印编辑画面任务", async () => {
    const w = await setup(original, "watermark");
    w.getComponent(ArchiveWatermarkControls).vm.$emit("upload", new File(["png"], "logo.png"));
    await flushPromises();
    const saved = structuredClone(original);
    saved.media[0].checksum = "b".repeat(64);
    saved.media[0].previewUrl = "/saved-watermark.mp4";
    saved.media[0].audioEdit = {
      revision: 1,
      original: { fileName: "video.mp4", mimeType: "video/mp4", size: 100, checksum: "a".repeat(64) },
      settings: defaultArchiveAudioSettings(),
      watermark: {
        file: { fileName: "logo.png", mimeType: "image/png", size: 10, checksum: "c".repeat(64) },
        width: 100,
        height: 50,
        settings: defaultArchiveWatermarkSettings()
      },
      updatedAt: "2026-11-04"
    };
    mocks.detail.mockResolvedValueOnce(saved);
    let finishBase!: (value: ArchiveVideoEditJob) => void;
    mocks.create.mockResolvedValueOnce(pending).mockReturnValueOnce(
      new Promise<ArchiveVideoEditJob>((resolve) => {
        finishBase = resolve;
      })
    );
    await button(w, "保存为最新版本").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(w.emitted("saved")?.[0]).toEqual([saved]);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    const baseSignal = mocks.create.mock.calls[1][3] as AbortSignal;
    // 与页面的 @saved="item = $event" 一致，同一归档的新对象回写给编辑器。
    await w.setProps({ item: saved });
    await flushPromises();
    expect(baseSignal.aborted).toBe(false);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    finishBase({ ...pending, id: "clean_base123", mode: "preview" });
    mocks.get.mockResolvedValueOnce({
      ...pending,
      id: "clean_base123",
      mode: "preview",
      status: "completed",
      previewUrl: "/clean-watermark-base.mp4"
    });
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(w.get("video").attributes("src")).toContain("/clean-watermark-base.mp4");
    expect(w.text()).not.toContain("ARCHIVE_EDIT_BUSY");
    expect(button(w, "重试水印编辑画面")).toBeUndefined();
    expect(button(w, "保存为最新版本").props("disabled")).toBe(false);
    await button(w, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({ mode: "save", revision: 1, checksum: "b".repeat(64) });
  });
  it("保存终态刷新详情期间保持操作锁，切换水印面板不抢先创建新任务", async () => {
    const w = await setup();
    let finishDetail!: (value: ContentArchiveItem) => void;
    mocks.detail.mockReturnValueOnce(
      new Promise<ContentArchiveItem>((resolve) => {
        finishDetail = resolve;
      })
    );
    await button(w, "保存为最新版本").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(mocks.detail).toHaveBeenCalledTimes(1);
    expect(button(w, "保存为最新版本").props("disabled")).toBe(true);
    await button(w, "水印设置").trigger("click");
    await flushPromises();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    finishDetail(original);
    await flushPromises();
    expect(button(w, "保存为最新版本").props("disabled")).toBe(false);
  });
  it("submits the dragged music range for both full audition and saving and does not shorten the range to a preview clip", async () => {
    const item = structuredClone(original);
    item.media[0].durationMs = 22000;
    mocks.music.mockResolvedValue({ items: [{ ...selectedMusic, duration: 120 }], total: 1 });
    const w = await setup(item);
    w.findAllComponents(NSelect)
      .find((s) => s.attributes("aria-label") === "选择背景音乐")!
      .vm.$emit("update:value", selectedMusic.id);
    await flushPromises();
    const range = w.getComponent(ArchiveMusicRange);
    range.vm.$emit("update:start", 42);
    await button(w, "试听完整视频效果").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({
      mode: "preview",
      previewFullLength: true,
      settings: { musicStartSeconds: 42 }
    });
    mocks.get.mockResolvedValueOnce({
      ...pending,
      mode: "preview",
      status: "completed",
      progress: 100,
      previewUrl: "/full.mp4"
    });
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    w.getComponent(ArchiveWatermarkPreview).vm.$emit("duration", 15);
    await flushPromises();
    expect(range.props("videoDuration")).toBe(22);
    expect(w.text()).not.toContain("音乐起点（秒）");
    await button(w, "保存为最新版本").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({ mode: "save", settings: { musicStartSeconds: 42 } });
  });
  it("试听不替换归档，使用后台生成片段且不触发保存通知", async () => {
    mocks.create.mockResolvedValueOnce({ ...pending, mode: "preview" });
    mocks.get.mockResolvedValueOnce({
      ...pending,
      mode: "preview",
      status: "completed",
      progress: 100,
      previewUrl: "/preview.mp4"
    });
    const wrapper = await setup();
    await button(wrapper, "试听完整视频效果").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(wrapper.get("video").attributes("src")).toContain("/preview.mp4");
    expect(wrapper.text()).toContain("完整试听（尚未保存）");
    expect(mocks.create.mock.lastCall?.[2]).toMatchObject({ previewFullLength: true, previewStartSeconds: 0 });
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(wrapper.emitted("saved")).toBeUndefined();
  });
  it("重新打开可接续后台任务，关闭窗口不取消任务，卸载后停止轮询", async () => {
    mocks.list.mockResolvedValueOnce([pending]);
    mocks.get.mockResolvedValue(pending);
    const wrapper = await setup();
    expect(wrapper.text()).toContain("正在生成");
    await button(wrapper, "关闭窗口").trigger("click");
    expect(wrapper.emitted("update:show")?.[0]).toEqual([false]);
    expect(mocks.cancel).not.toHaveBeenCalled();
    await wrapper.setProps({ show: false });
    const calls = mocks.get.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.get).toHaveBeenCalledTimes(calls);
    expect((mocks.list.mock.calls[0][2] as AbortSignal).aborted).toBe(true);
  });
  it("停止任务可继续编辑，恢复原片需确认且不删除音乐库", async () => {
    const edited = structuredClone(original);
    edited.media[0].audioEdit = {
      revision: 1,
      original: { fileName: "video.mp4", mimeType: "video/mp4", size: 100, checksum: "a".repeat(64) },
      settings: defaultArchiveAudioSettings(),
      updatedAt: "2026-10-28"
    };
    mocks.list.mockResolvedValueOnce([pending]);
    const wrapper = await setup(edited);
    await button(wrapper, "停止当前任务").trigger("click");
    await flushPromises();
    expect(mocks.cancel).toHaveBeenCalled();
    mocks.confirm.mockResolvedValueOnce(false);
    await button(wrapper, "恢复原始视频").trigger("click");
    await flushPromises();
    expect(mocks.create).not.toHaveBeenCalled();
    await button(wrapper, "恢复原始视频").trigger("click");
    await flushPromises();
    expect(mocks.create.mock.lastCall?.[2].mode).toBe("restore");
  });
  it("运行时缺失时禁止生成，保留原片查看和错误提示", async () => {
    mocks.runtime.mockResolvedValueOnce({ ready: false });
    const wrapper = await setup();
    expect(button(wrapper, "保存为最新版本").props("disabled")).toBe(true);
    expect(wrapper.text()).toContain("FFmpeg 共享媒体运行时");
    await button(wrapper, "查看原始视频").trigger("click");
    expect(wrapper.get("video").attributes("src")).toContain("/original");
  });
  it("请求迟到或切换作品后，不把旧任务成品写到新作品", async () => {
    mocks.list.mockResolvedValueOnce([pending]);
    let resolve!: (value: ArchiveVideoEditJob) => void;
    mocks.get.mockReturnValueOnce(
      new Promise<ArchiveVideoEditJob>((done) => {
        resolve = done;
      })
    );
    const wrapper = await setup();
    await vi.advanceTimersByTimeAsync(800);
    const next = { ...structuredClone(original), id: "archive_other123" };
    await wrapper.setProps({ item: next });
    await flushPromises();
    resolve({ ...pending, status: "completed" });
    await flushPromises();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(wrapper.emitted("saved")).toBeUndefined();
  });
});
