import { afterEach, expect, it, vi } from "vitest";
import { defaultArchiveStudio, defaultArchiveInterpolation, type ContentArchiveMedia } from "@toolbox/shared/archive";
import { videoEditApi } from "./video-edit-api";
import { useReversePreview } from "./useReversePreview";
vi.mock("./video-edit-api", () => ({
  videoEditApi: { create: vi.fn(), get: vi.fn(), cancel: vi.fn(async () => undefined) }
}));
const media = { id: "media_001", checksum: "a".repeat(64) } as ContentArchiveMedia;
const studio = defaultArchiveStudio();
const clip = { id: "clip_001", start: 2, end: 8, reverse: true };
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
it("缓存倒放源，后续裁剪、变速、音量调整直接复用，不重复生成", async () => {
  vi.mocked(videoEditApi.create).mockResolvedValue({
    id: "preview_001",
    status: "completed",
    previewUrl: "/reverse.mp4"
  } as never);
  const preview = useReversePreview(
    () => "item_0001",
    () => media
  );
  await preview.prepare([clip], studio);
  await preview.prepare([{ ...clip, start: 4, end: 6, speed: 2, volume: 20 }], studio);
  expect(videoEditApi.create).toHaveBeenCalledTimes(1);
  expect(preview.asset({ ...clip, start: 4, end: 6 }, studio)).toMatchObject({ start: 2, end: 8, url: "/reverse.mp4" });
  expect(preview.preparing.value).toBe(false);
  preview.reset();
});
it("处理时可取消服务端任务，并阻止取消后的片段提交", async () => {
  vi.useFakeTimers();
  vi.mocked(videoEditApi.create).mockResolvedValue({ id: "preview_001", status: "running" } as never);
  const preview = useReversePreview(
    () => "item_0001",
    () => media
  );
  const promise = preview.prepare([clip], studio);
  const rejection = expect(promise).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  preview.reset(false);
  await rejection;
  expect(videoEditApi.cancel).toHaveBeenCalledWith("preview_001");
  expect(preview.preparing.value).toBe(false);
  expect(preview.asset(clip, studio)).toBeUndefined();
});
it("轮询失败时终止服务端任务，解除加载状态并保留原片", async () => {
  vi.useFakeTimers();
  vi.mocked(videoEditApi.create).mockResolvedValue({ id: "preview_001", status: "running" } as never);
  vi.mocked(videoEditApi.get).mockRejectedValue(new Error("network failed"));
  const preview = useReversePreview(
    () => "item_0001",
    () => media
  );
  const promise = preview.prepare([clip], studio);
  const rejection = expect(promise).rejects.toThrow("network failed");
  await vi.advanceTimersByTimeAsync(600);
  await rejection;
  expect(videoEditApi.cancel).toHaveBeenCalledWith("preview_001");
  expect(preview.preparing.value).toBe(false);
  expect(preview.asset(clip, studio)).toBeUndefined();
  preview.reset();
});
it("补帧预览烘焙速度并隔离目标帧率，声音和空间调整仍复用同一画面", async () => {
  vi.mocked(videoEditApi.create).mockResolvedValue({
    id: "preview_002",
    status: "completed",
    previewUrl: "/interpolated.mp4"
  } as never);
  const preview = useReversePreview(
    () => "item_0001",
    () => media
  );
  const interpolated = { ...clip, reverse: false, speed: 0.5, interpolation: defaultArchiveInterpolation() };
  await preview.prepare([interpolated], studio, 60);
  expect(videoEditApi.create).toHaveBeenLastCalledWith(
    "item_0001",
    media.id,
    expect.objectContaining({
      purpose: "interpolation-source",
      frame: expect.objectContaining({ fps: 60 }),
      cut: [expect.objectContaining({ speed: 0.5, interpolation: interpolated.interpolation })]
    }),
    expect.any(AbortSignal)
  );
  expect(preview.asset(interpolated, studio, 60)).toMatchObject({ interpolation: true, speed: 0.5 });
  expect(preview.asset(interpolated, studio, 120)).toBeUndefined();
  await preview.prepare([{ ...interpolated, volume: 0, transform: { angle: 90 } }], studio, 60);
  expect(videoEditApi.create).toHaveBeenCalledTimes(1);
  preview.reset();
});
