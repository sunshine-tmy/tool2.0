import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";
import {
  defaultArchiveInterpolation,
  defaultArchiveWatermarkSettings,
  type ArchiveStudioSource,
  type ArchiveSubtitle,
  type ContentArchiveMedia
} from "@toolbox/shared/archive";
import { videoEditApi } from "./video-edit-api";
import { useArchiveRoughCut } from "./useArchiveRoughCut";
vi.mock("./video-edit-api", () => ({
  videoEditApi: {
    cutSource: vi.fn(async () => ({ duration: 10, fps: 30, width: 720, height: 1280, checksum: "a".repeat(64) })),
    saveCutDraft: vi.fn(async () => undefined),
    create: vi.fn(async () => ({ id: "preview_001", status: "completed", previewUrl: "/reversed.mp4", progress: 100 })),
    cancel: vi.fn(async () => undefined)
  }
}));
let scope: EffectScope;
beforeEach(() => {
  scope = effectScope();
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  scope.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function editor(overrides: Partial<ContentArchiveMedia> = {}) {
  const media = {
    id: "media_001",
    checksum: "a".repeat(64),
    fileName: "video.mp4",
    ...overrides
  } as ContentArchiveMedia;
  const edit = scope.run(() =>
    useArchiveRoughCut(
      () => "item_0001",
      () => media,
      () => undefined,
      () => false,
      () => "/video.mp4"
    )
  )!;
  await edit.load();
  return edit;
}
const imported: ArchiveStudioSource = {
  id: "source_001",
  itemId: "item_0002",
  mediaId: "media_002",
  checksum: "b".repeat(64),
  title: "已导入",
  fileName: "two.mp4",
  duration: 5,
  width: 1280,
  height: 720,
  fps: 30
};
it("导入只增加素材库；点击加号才在当前视频轨道末尾插入片段，重复导入不重复登记", async () => {
  const edit = await editor(),
    times = edit.clips.value.map(({ id, start, end, at }) => ({ id, start, end, at }));
  edit.registerSource(imported);
  edit.registerSource(imported);
  expect(edit.studio.value.sources).toHaveLength(1);
  expect(edit.clips.value.map(({ id, start, end, at }) => ({ id, start, end, at }))).toEqual(times);
  expect(edit.duration.value).toBe(10);
  edit.appendSource(imported);
  expect(edit.clips.value).toHaveLength(2);
  expect(edit.clips.value[1]).toMatchObject({
    sourceId: imported.id,
    at: 10,
    start: 0,
    end: 5,
    lane: edit.clips.value[0].lane
  });
  expect(edit.duration.value).toBe(15);
});
it("默认文本和重叠的 SRT 文本均放到视频上方，整次导入可撤回", async () => {
  const edit = await editor(),
    original = JSON.parse(JSON.stringify(edit.clips.value));
  const cue = (id: string, start: number, end: number): ArchiveSubtitle => ({
    id,
    start,
    end,
    text: "文本",
    fontSize: 36,
    color: "#ffffff",
    position: "center"
  });
  edit.insertTexts([cue("text_001", 0, 3), cue("text_002", 1, 4)]);
  expect(edit.studio.value.subtitles).toHaveLength(2);
  const videoLane = edit.clips.value[0].lane!;
  expect(edit.studio.value.subtitles.every((text) => text.lane! < videoLane)).toBe(true);
  expect(edit.studio.value.subtitles[0].lane).not.toBe(edit.studio.value.subtitles[1].lane);
  expect(edit.selected.value).toEqual(["text_001"]);
  edit.undoEdit();
  expect(edit.studio.value.subtitles).toHaveLength(0);
  expect(edit.clips.value).toEqual(original);
});

it("文本新属性保留在草稿中，改变另一项属性后可逐步撤回", async () => {
  const edit = await editor();
  edit.insertTexts([
    { id: "text_001", start: 0, end: 3, text: "文本", fontSize: 36, color: "#ffffff", position: "center" }
  ]);
  edit.updateSubtitle("text_001", { bold: true, fontFamily: "Microsoft YaHei", letterSpacing: 4 });
  edit.updateSubtitle("text_001", { opacity: 0.5 });
  expect(edit.studio.value.subtitles[0]).toMatchObject({
    bold: true,
    fontFamily: "Microsoft YaHei",
    letterSpacing: 4,
    opacity: 0.5
  });
  edit.undoEdit();
  expect(edit.studio.value.subtitles[0]).toMatchObject({ bold: true, letterSpacing: 4 });
  expect(edit.studio.value.subtitles[0].opacity).toBeUndefined();
  edit.undoEdit();
  expect(edit.studio.value.subtitles[0].bold).toBeUndefined();
});

it("花字和普通样式之间的离散切换可分别撤回", async () => {
  const edit = await editor();
  edit.insertTexts([
    { id: "text_001", start: 0, end: 3, text: "文本", fontSize: 36, color: "#ffffff", position: "center" }
  ]);
  edit.updateSubtitle("text_001", { decoration: "flame-blue", bold: true }, true);
  edit.updateSubtitle("text_001", { decoration: "none" }, true);
  edit.undoEdit();
  expect(edit.studio.value.subtitles[0]).toMatchObject({ decoration: "flame-blue", bold: true });
  edit.undoEdit();
  expect(edit.studio.value.subtitles[0].decoration).toBeUndefined();
});

it("视频旋转和镜像独立于其他片段，并且可撤回", async () => {
  const edit = await editor();
  edit.appendOriginal();
  const [first, second] = edit.clips.value;
  edit.selected.value = [first.id];
  edit.rotateVideo();
  edit.mirrorVideo();
  expect(edit.clips.value[0].transform).toMatchObject({ angle: 90, flipX: true });
  expect(edit.clips.value[1].transform).toBeUndefined();
  edit.undoEdit();
  expect(edit.clips.value[0].transform).toEqual({ angle: 90 });
  edit.selected.value = [second.id];
  edit.updateClip(second.id, { locked: true });
  expect(edit.canVideoTools.value).toBe(false);
});

it("指针定格插入 3 秒静帧，同轨后续顺延，其他轨道不变，整次操作可撤回", async () => {
  const edit = await editor();
  edit.appendOriginal();
  const first = edit.clips.value[0];
  edit.insertTexts([
    { id: "text_001", start: 4, end: 8, text: "文本", fontSize: 36, color: "#ffffff", position: "center" }
  ]);
  edit.selected.value = [first.id];
  edit.seek(4);
  const before = structuredClone(JSON.parse(JSON.stringify(edit.clips.value)));
  edit.freezeVideo();
  expect(edit.clips.value).toHaveLength(4);
  expect(edit.clips.value.map(({ at, start, end, freezeAt }) => ({ at, start, end, freezeAt }))).toEqual([
    { at: 0, start: 0, end: 4, freezeAt: undefined },
    { at: 4, start: 0, end: 3, freezeAt: 4 },
    { at: 7, start: 4, end: 10, freezeAt: undefined },
    { at: 13, start: 0, end: 10, freezeAt: undefined }
  ]);
  expect(edit.studio.value.subtitles[0].start).toBe(4);
  expect(edit.clips.value[1].muted).toBe(true);
  expect(new Set(edit.clips.value.map((clip) => clip.lane)).size).toBe(1);
  edit.undoEdit();
  expect(edit.clips.value).toEqual(before);
  edit.seek(23);
  expect(edit.canFreeze.value).toBe(false);
});

it("倒放后左右裁剪和拆分遵循播放顺序，静帧拆分仍保持取帧位置", async () => {
  const edit = await editor();
  const id = edit.clips.value[0].id;
  edit.selected.value = [id];
  await edit.reverseVideo();
  expect(edit.clips.value[0].reverse).toBe(true);
  edit.seek(4);
  edit.split();
  expect(edit.clips.value.map(({ start, end, at }) => ({ start, end, at }))).toEqual([
    { start: 6, end: 10, at: 0 },
    { start: 0, end: 6, at: 4 }
  ]);
  edit.undoEdit();
  edit.selected.value = [id];
  edit.seek(4);
  edit.trim("left");
  expect(edit.clips.value[0]).toMatchObject({ start: 0, end: 6, at: 4, reverse: true });
  edit.undoEdit();
  edit.selected.value = [id];
  edit.seek(4);
  edit.freezeVideo();
  const still = edit.clips.value[1];
  expect(still.freezeAt).toBeCloseTo(6 - 1 / 30, 6);
  edit.seek(5);
  edit.split();
  expect(edit.clips.value.filter((clip) => clip.freezeAt !== undefined)).toHaveLength(2);
  expect(
    edit.clips.value.filter((clip) => clip.freezeAt !== undefined).every((clip) => clip.freezeAt === still.freezeAt)
  ).toBe(true);
});

it("选中不含指针的片段或同轨后续片段锁定时禁止定格", async () => {
  const edit = await editor();
  edit.appendOriginal();
  const [first, second] = edit.clips.value;
  edit.updateClip(second.id, { locked: true });
  edit.selected.value = [first.id];
  edit.seek(2);
  expect(edit.canFreeze.value).toBe(false);
  edit.selected.value = [second.id];
  expect(edit.canFreeze.value).toBe(false);
});

it("复制粘贴保留视频属性，在指针处避开重叠，并支持整次撤回重做及重复粘贴", async () => {
  const edit = await editor();
  const original = edit.clips.value[0];
  edit.updateClip(original.id, { reverse: true, speed: 2, volume: 70, transform: { angle: 90, flipX: true } });
  edit.selected.value = [original.id];
  edit.copySelection();
  edit.seek(2);
  edit.pasteSelection();
  expect(edit.clips.value).toHaveLength(2);
  const pasted = edit.clips.value[1];
  expect(pasted).toMatchObject({
    at: 2,
    start: 0,
    end: 10,
    reverse: true,
    speed: 2,
    volume: 70,
    transform: { angle: 90, flipX: true }
  });
  expect(pasted.id).not.toBe(original.id);
  expect(pasted.lane).toBeLessThan(edit.clips.value[0].lane!);
  expect(edit.selected.value).toEqual([pasted.id]);
  edit.undoEdit();
  expect(edit.clips.value).toHaveLength(1);
  edit.redoEdit();
  expect(edit.clips.value[1]).toEqual(pasted);
  edit.seek(10);
  edit.pasteSelection();
  expect(edit.clips.value).toHaveLength(3);
  expect(new Set(edit.clips.value.map((clip) => clip.id)).size).toBe(3);
});

it("混合多选粘贴保留相对时间和层级，定格、文本、音频均保留各自设置", async () => {
  const edit = await editor();
  edit.selected.value = [edit.clips.value[0].id];
  edit.seek(2);
  edit.freezeVideo();
  const still = edit.clips.value[1];
  edit.insertTexts([
    { id: "text_001", start: 3, end: 5, text: "文本", fontSize: 36, color: "#ffffff", position: "center", bold: true }
  ]);
  edit.updateStudio({
    ...edit.studio.value,
    musicTracks: [
      {
        id: "music_001",
        lane: 2,
        libraryItemId: "audio_001",
        libraryRevision: 1,
        title: "配乐",
        start: 4,
        end: 8,
        sourceStart: 2,
        speed: 1.5,
        volume: 80,
        loop: false,
        fadeIn: 0.4,
        fadeOut: 0.6
      }
    ]
  });
  edit.selected.value = [still.id, "text_001", "music_001"];
  edit.copySelection();
  edit.seek(4);
  edit.pasteSelection();
  const copied = new Set(edit.selected.value);
  const video = edit.clips.value.find((clip) => copied.has(clip.id))!;
  const text = edit.studio.value.subtitles.find((cue) => copied.has(cue.id))!;
  const music = edit.studio.value.musicTracks.find((track) => copied.has(track.id))!;
  expect(video).toMatchObject({ at: 4, start: 0, end: 3, freezeAt: 2, muted: true });
  expect(text).toMatchObject({ start: 5, end: 7, text: "文本", bold: true });
  expect(music).toMatchObject({ start: 6, end: 10, sourceStart: 2, speed: 1.5, volume: 80, fadeIn: 0.4, fadeOut: 0.6 });
  expect(text.lane).toBeLessThan(video.lane!);
  expect(video.lane).toBeLessThan(music.lane!);
});

it("清空时间线后仍能粘贴已复制素材，切换视频后清空内部剪贴板", async () => {
  const edit = await editor();
  edit.registerSource(imported);
  edit.appendSource(imported);
  const clip = edit.clips.value[1];
  edit.selected.value = [clip.id];
  edit.copySelection();
  edit.selected.value = edit.clips.value.map((entry) => entry.id);
  edit.remove();
  edit.updateStudio({ ...edit.studio.value, sources: [] });
  edit.seek(0);
  edit.pasteSelection();
  expect(edit.clips.value).toHaveLength(1);
  expect(edit.clips.value[0]).toMatchObject({ sourceId: imported.id, at: 0 });
  expect(edit.studio.value.sources).toEqual([imported]);
  edit.reset();
  expect(edit.canPaste.value).toBe(false);
});

it("打开历史片段补帧工程不启动推理，保留原剪辑并提示保存时重新确认", async () => {
  const before = vi.mocked(videoEditApi.create).mock.calls.length;
  const edit = await editor({
    audioEdit: {
      original: { fileName: "video.mp4" },
      cut: [{ id: "legacy_001", start: 1, end: 8, speed: 2, volume: 80, interpolation: defaultArchiveInterpolation() }]
    } as ContentArchiveMedia["audioEdit"]
  });
  await vi.advanceTimersByTimeAsync(500);
  expect(edit.legacyInterpolation.value).toBe(true);
  expect(edit.clips.value[0]).toMatchObject({ start: 1, end: 8, speed: 2, volume: 80 });
  expect(edit.clips.value[0].interpolation).toBeUndefined();
  expect(vi.mocked(videoEditApi.create).mock.calls.length).toBe(before);
});
it("历史补帧定格保留取帧配方，仍可恢复生成后的画面", async () => {
  const sample = {
    start: 0,
    end: 10,
    speed: 1,
    reverse: false,
    time: 2.125,
    fps: 60 as const,
    interpolation: defaultArchiveInterpolation()
  };
  const edit = await editor({
    audioEdit: {
      original: { fileName: "video.mp4" },
      cut: [{ id: "frozen_001", start: 0, end: 3, freezeAt: 2.125, freezeSample: sample }]
    } as ContentArchiveMedia["audioEdit"]
  });
  await vi.advanceTimersByTimeAsync(500);
  expect(edit.clips.value[0].freezeSample).toEqual(sample);
  expect(edit.freezeSources.value.frozen_001).toMatchObject({ url: "/reversed.mp4", time: sample.time });
});

it("水印支持拆分、裁剪、复制粘贴、锁定、撤回和草稿恢复引用", async () => {
  const edit = await editor();
  edit.addWatermark({
    id: "mark_001",
    title: "水印",
    start: 0,
    end: 10,
    sourceStart: 0,
    followEnd: true,
    asset: { kind: "draft", id: "draft_000001", width: 100, height: 50 },
    settings: defaultArchiveWatermarkSettings()
  });
  expect(edit.studio.value.watermarks).toHaveLength(1);
  expect(edit.clips.value[0].lane).toBe(1);
  edit.time.value = 4;
  edit.split();
  expect(edit.studio.value.watermarks).toHaveLength(2);
  expect(edit.studio.value.watermarks?.[1]).toMatchObject({ start: 4, end: 10, sourceStart: 4, followEnd: false });
  edit.copySelection();
  edit.time.value = 10;
  edit.pasteSelection();
  expect(edit.studio.value.watermarks).toHaveLength(4);
  expect(edit.studio.value.watermarks?.every((mark) => mark.asset.id === "draft_000001")).toBe(true);
  edit.undoEdit();
  expect(edit.studio.value.watermarks).toHaveLength(2);
  edit.selected.value = [edit.studio.value.watermarks![1].id];
  edit.time.value = 7;
  edit.trim("left");
  expect(edit.studio.value.watermarks?.[1]).toMatchObject({ start: 7, sourceStart: 7 });
  edit.toggleTrack(edit.studio.value.watermarks![1].lane!, "locked");
  edit.remove();
  expect(edit.studio.value.watermarks).toHaveLength(2);
  await edit.flush();
  expect(videoEditApi.saveCutDraft).toHaveBeenLastCalledWith(
    "item_0001",
    "media_001",
    expect.objectContaining({ studio: expect.objectContaining({ unified: true, watermarks: expect.any(Array) }) }),
    expect.any(AbortSignal)
  );
});

it("并发读取工程共享同一探测请求，调用方等待载入完成再添加素材", async () => {
  let finish!: (result: { duration: number; fps: number; width: number; height: number; checksum: string }) => void;
  vi.mocked(videoEditApi.cutSource).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const media = { id: "media_001", checksum: "a".repeat(64), fileName: "video.mp4" } as ContentArchiveMedia;
  const edit = scope.run(() =>
    useArchiveRoughCut(
      () => "item_0001",
      () => media,
      () => undefined,
      () => false,
      () => "/video.mp4"
    )
  )!;
  const one = edit.load(),
    two = edit.load();
  expect(one).toBe(two);
  expect(edit.loaded.value).toBe(false);
  finish({ duration: 10, fps: 30, width: 720, height: 1280, checksum: "a".repeat(64) });
  await two;
  expect(edit.loaded.value).toBe(true);
  expect(edit.clips.value).toHaveLength(1);
});
