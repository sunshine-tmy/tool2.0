// @vitest-environment happy-dom
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NButton, NSelect, NSlider } from "naive-ui";
import { defaultArchiveAudioSettings, type ArchiveVideoEditJob, type ContentArchiveItem } from "@toolbox/shared";
import ArchiveAudioEditor from "./ArchiveAudioEditor.vue";
const mocks = vi.hoisted(() => ({
  runtime: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  music: vi.fn(),
  upload: vi.fn(),
  detail: vi.fn(),
  confirm: vi.fn()
}));
vi.mock("./video-edit-api", () => ({ videoEditApi: mocks }));
vi.mock("../audio-library/integrations/music", () => ({
  archiveMusicLibraryApi: { list: mocks.music, upload: mocks.upload }
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
  mocks.create.mockReset().mockResolvedValue(pending);
  mocks.get.mockReset().mockResolvedValue({ ...pending, status: "completed", progress: 100 });
  mocks.detail.mockReset().mockResolvedValue(original);
  mocks.confirm.mockReset().mockResolvedValue(true);
  mocks.cancel.mockReset().mockResolvedValue({ ...pending, status: "cancelled" });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  wrappers = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function setup(item = original) {
  const wrapper = mount(ArchiveAudioEditor, {
    props: { show: true, item, mediaId: item.media[0].id },
    global: {
      stubs: { teleport: true, Modal: { template: "<div><slot /></div>" }, NModal: { template: "<div><slot /></div>" } }
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
    await button(wrapper, "试听 15 秒效果").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(800);
    await flushPromises();
    expect(wrapper.get("video").attributes("src")).toContain("/preview.mp4");
    expect(wrapper.text()).toContain("试听片段（尚未保存）");
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
