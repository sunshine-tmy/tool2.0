// @vitest-environment happy-dom
import { effectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { defaultArchiveWatermarkSettings, type ArchiveVideoEditJob } from "@toolbox/shared/archive";
import { archiveFixture } from "./__tests__/fixtures";
import { useArchiveImageBatch } from "./useArchiveImageBatch";
import type { ImageBatchRecipe } from "./image-batch-recipe";
const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  uploadWatermark: vi.fn(),
  selectLibraryWatermark: vi.fn()
}));
vi.mock("./content-api", () => ({ contentArchiveApi: { detail: mocks.detail } }));
vi.mock("./video-edit-api", () => ({ videoEditApi: mocks }));
let scope: ReturnType<typeof effectScope>;
function image(id: string) {
  const item = archiveFixture({ id, type: "image" });
  item.media[0].kind = "image";
  return item;
}
const recipe: ImageBatchRecipe = {
  kind: "audio",
  secondsPerImage: 3,
  aspect: "portrait",
  music: { id: "music-1", revision: 1, volume: 25, start: 0, loop: true }
};
const job = (id = "job-123", status: ArchiveVideoEditJob["status"] = "completed"): ArchiveVideoEditJob => ({
  id,
  status,
  itemId: "image-1",
  mediaId: "media-123",
  mode: "save",
  stage: status,
  progress: status === "completed" ? 100 : 10,
  message: status,
  createdAt: "2026-11-04T00:00:00Z",
  updatedAt: "2026-11-04T00:00:00Z"
});
function setup() {
  scope = effectScope();
  const updated = vi.fn(),
    finished = vi.fn();
  const batch = scope.run(() => useArchiveImageBatch(updated, finished))!;
  batch.reset([
    { id: "image-1", title: "图文一" },
    { id: "image-2", title: "图文二" }
  ]);
  return { batch, updated, finished };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  mocks.detail.mockImplementation(async (id: string) => image(id));
  mocks.list.mockResolvedValue([]);
  mocks.create.mockImplementation(async (id: string) => job(`job-${id}`, "pending"));
  mocks.get.mockImplementation(async (id: string) => job(id));
  mocks.cancel.mockImplementation(async (id: string) => ({ ...job(id, "cancelled"), mode: "preview" }));
  mocks.selectLibraryWatermark.mockImplementation(async (id: string) => ({ id: `draft-${id}` }));
});
afterEach(() => {
  scope?.stop();
  vi.useRealTimers();
});
describe("图文批量队列", () => {
  it("逐条生成完整效果预览，不保存、不改变批量结果；参数未改时复用，改动后重新生成", async () => {
    const { batch, updated, finished } = setup();
    mocks.get.mockImplementation(async (id: string) => ({ ...job(id), mode: "preview", previewUrl: `/preview/${id}` }));
    const combined = {
      ...recipe,
      watermark: { libraryId: "logo12345678", settings: defaultArchiveWatermarkSettings() }
    };
    await batch.preview("image-1", combined);
    expect(mocks.create.mock.calls[0][2]).toMatchObject({
      mode: "preview",
      previewFullLength: true,
      previewStartSeconds: 0,
      slideshow: { secondsPerImage: 3 },
      watermark: { draftId: "draft-image-1", settings: { endSeconds: null } },
      settings: { musicStartSeconds: 0, loop: true }
    });
    expect(batch.rows.value[0]).toMatchObject({
      status: "pending",
      progress: 0,
      durationSeconds: 3,
      preview: { status: "completed", source: "effect", url: "/preview/job-image-1" }
    });
    expect(batch.processed.value).toBe(0);
    expect(updated).not.toHaveBeenCalled();
    expect(finished).not.toHaveBeenCalled();
    await batch.preview("image-1", combined);
    expect(mocks.create).toHaveBeenCalledOnce();
    batch.invalidatePreviews();
    expect(batch.rows.value[0].preview).toBeUndefined();
    await batch.preview("image-1", combined);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.selectLibraryWatermark).toHaveBeenCalledTimes(2);
  });
  it("预览中禁止平行预览、重置及开始保存，主动停止只取消该预览任务", async () => {
    const { batch, updated } = setup();
    mocks.get.mockResolvedValue({ ...job("preview-1", "running"), mode: "preview" });
    const preview = batch.preview("image-1", recipe);
    await flushPromises();
    expect(batch.previewPending.value).toBe(true);
    await batch.preview("image-2", recipe);
    await batch.run(recipe);
    batch.reset([{ id: "replacement", title: "替换" }]);
    expect(batch.rows.value.map((row) => row.id)).toEqual(["image-1", "image-2"]);
    expect(mocks.create).toHaveBeenCalledOnce();
    await batch.stopPreview();
    await preview;
    expect(mocks.cancel.mock.calls[0][0]).toBe("job-image-1");
    expect(batch.rows.value[0].preview?.status).toBe("stopped");
    expect(batch.previewPending.value).toBe(false);
    expect(batch.previewing.value).toBe(false);
    expect(updated).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("预览状态中断后续读同一任务，既不重复渲染，也不把预览当作保存成功", async () => {
    const { batch, updated, finished } = setup();
    mocks.get.mockRejectedValueOnce(new Error("读取中断"));
    await batch.preview("image-1", recipe);
    expect(batch.previewPending.value).toBe(true);
    await batch.run(recipe);
    expect(mocks.create).toHaveBeenCalledOnce();
    mocks.get.mockResolvedValueOnce({ ...job("job-image-1"), mode: "preview", previewUrl: "/full-preview.mp4" });
    await batch.preview("image-1", recipe);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.get.mock.calls.map((call) => call[0])).toEqual(["job-image-1", "job-image-1"]);
    expect(batch.rows.value[0].preview?.url).toBe("/full-preview.mp4");
    expect(batch.previewPending.value).toBe(false);
    expect(updated).not.toHaveBeenCalled();
    expect(finished).not.toHaveBeenCalled();
  });
  it("保存完成后预览使用返回的新视频和实际时长，不播放先前效果或再次提交任务", async () => {
    const { batch } = setup();
    batch.reset([{ id: "image-1", title: "图文一" }]);
    const saved = image("image-1");
    saved.media.push({
      ...saved.media[0],
      id: "saved-video",
      kind: "video",
      durationMs: 12500,
      previewUrl: "/latest.mp4?v=new-checksum",
      derivedFromImages: saved.media.map(({ id, checksum }) => ({ id, checksum }))
    });
    mocks.detail.mockResolvedValueOnce(image("image-1")).mockResolvedValueOnce(saved);
    mocks.get.mockResolvedValueOnce({ ...job("job-image-1"), resultMediaId: "saved-video" });
    await batch.run(recipe);
    expect(batch.rows.value[0]).toMatchObject({
      durationSeconds: 12.5,
      preview: { source: "saved", url: "/latest.mp4?v=new-checksum" }
    });
    await batch.preview("image-1");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.detail).toHaveBeenCalledTimes(2);
  });
  it("预览失败及缺失地址可重试，校验固定水印时间时不上传无效作品的草稿", async () => {
    const { batch, updated } = setup();
    await batch.preview("image-1", {
      ...recipe,
      watermark: { libraryId: "logo12345678", settings: { ...defaultArchiveWatermarkSettings(), endSeconds: 4 } }
    });
    expect(batch.rows.value[0].preview?.message).toContain("视频时长");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.selectLibraryWatermark).not.toHaveBeenCalled();
    await batch.preview("image-1", recipe);
    expect(batch.rows.value[0].preview?.status).toBe("failed");
    expect(batch.previewPending.value).toBe(false);
    mocks.get.mockResolvedValueOnce({ ...job(), mode: "preview", previewUrl: "/recovered.mp4" });
    await batch.preview("image-1", recipe);
    expect(batch.rows.value[0].preview?.url).toBe("/recovered.mp4");
    expect(updated).not.toHaveBeenCalled();
  });
  it("卸载中止预览等待和迟到请求，不创建后续任务或污染归档", async () => {
    const { batch, updated } = setup();
    mocks.get.mockResolvedValue({ ...job("preview-1", "running"), mode: "preview" });
    const preview = batch.preview("image-1", recipe);
    await flushPromises();
    scope.stop();
    await preview;
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("页面卸载后迟到的图文详情不再上传素材或提交编辑", async () => {
    const { batch, updated } = setup();
    let resolve!: (value: ReturnType<typeof image>) => void;
    mocks.detail.mockImplementationOnce(
      () =>
        new Promise<ReturnType<typeof image>>((done) => {
          resolve = done;
        })
    );
    const pending = batch.run(recipe);
    scope.stop();
    resolve(image("image-1"));
    await pending;
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();
  });
  it("一次只提交一条，保存完成后刷新详情，重复点击不会启动平行队列", async () => {
    const { batch, updated, finished } = setup();
    mocks.get.mockResolvedValueOnce(job("job-image-1", "running"));
    const promise = batch.run(recipe);
    await flushPromises();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await batch.run(recipe);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(batch.rows.value[0].status).toBe("running");
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(updated).toHaveBeenCalledTimes(2);
    expect(batch.processed.value).toBe(2);
    expect(finished).toHaveBeenCalledOnce();
  });
  it("混合选择与单项失败不影响后续项，重试仅处理失败项", async () => {
    const { batch } = setup();
    mocks.detail.mockResolvedValueOnce(archiveFixture()).mockResolvedValueOnce(image("image-2"));
    await batch.run(recipe);
    expect(batch.rows.value.map((row) => row.status)).toEqual(["failed", "completed"]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await batch.run(undefined, true);
    expect(batch.rows.value.every((row) => row.status === "completed")).toBe(true);
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("每条作品独立创建水印草稿，复用的是素材而不是其他作品的草稿ID", async () => {
    const { batch } = setup();
    await batch.run({
      ...recipe,
      kind: "watermark",
      watermark: { libraryId: "library12345", settings: defaultArchiveWatermarkSettings() }
    });
    expect(mocks.selectLibraryWatermark.mock.calls.map((args) => args.slice(0, 3))).toEqual([
      ["image-1", "media-123", "library12345"],
      ["image-2", "media-123", "library12345"]
    ]);
    expect(mocks.create.mock.calls.map((args) => args[2].watermark.draftId)).toEqual([
      "draft-image-1",
      "draft-image-2"
    ]);
  });
  it("停止后续处理允许当前项完成，不发送取消或提交其他项", async () => {
    const { batch } = setup();
    mocks.get.mockResolvedValueOnce(job("job-image-1", "running"));
    const promise = batch.run(recipe);
    await flushPromises();
    batch.stop();
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    expect(batch.rows.value.map((row) => row.status)).toEqual(["completed", "stopped"]);
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("状态请求失败暂停后续提交，继续时读取同一job，不重复创建", async () => {
    const { batch } = setup();
    mocks.get.mockRejectedValueOnce(new Error("网络中断"));
    await batch.run(recipe);
    expect(batch.paused.value).toBe(true);
    expect(mocks.create).toHaveBeenCalledOnce();
    await batch.run();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.get.mock.calls.map((args) => args[0])).toEqual(["job-image-1", "job-image-1", "job-image-2"]);
  });
  it("提交回执丢失时禁止盲目重发，明确跳过后只处理后续作品", async () => {
    const { batch } = setup();
    mocks.create.mockRejectedValueOnce(new Error("回执丢失"));
    await batch.run(recipe);
    expect(batch.rows.value[0].status).toBe("uncertain");
    await batch.run();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(batch.paused.value).toBe(true);
    batch.skipUncertain();
    await batch.run();
    expect(batch.rows.value[0].status).toBe("skipped");
    expect(mocks.get.mock.calls[0][0]).toBe("job-image-2");
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("已知其他活跃编辑任务不被接管；卸载停止后续请求且不取消服务端任务", async () => {
    const { batch, updated, finished } = setup();
    mocks.list.mockResolvedValueOnce([job("unrelated", "running")]);
    mocks.get.mockResolvedValue(job("job-image-2", "running"));
    const promise = batch.run(recipe);
    await flushPromises();
    expect(batch.rows.value[0].message).toContain("已有编辑任务");
    scope.stop();
    await promise;
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(updated).not.toHaveBeenCalled();
    expect(finished).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
