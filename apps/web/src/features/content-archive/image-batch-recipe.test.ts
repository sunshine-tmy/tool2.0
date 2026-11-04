import { describe, expect, it } from "vitest";
import {
  defaultArchiveAudioSettings,
  defaultArchiveWatermarkSettings,
  type ContentArchiveMedia
} from "@toolbox/shared/archive";
import { archiveFixture } from "./__tests__/fixtures";
import { imageBatchInput, imageBatchTarget, type ImageBatchRecipe } from "./image-batch-recipe";
const settings = defaultArchiveAudioSettings();
const original = { fileName: "original.mp4", mimeType: "video/mp4", size: 10, checksum: "b".repeat(64) };
function photos() {
  const item = archiveFixture({ type: "image" });
  item.media = [0, 1].map((index) => ({
    ...item.media[0],
    id: `image-${index}`,
    kind: "image",
    index,
    mimeType: "image/png"
  }));
  return item;
}
function recipe(): ImageBatchRecipe {
  return {
    kind: "audio",
    secondsPerImage: 3,
    aspect: "portrait",
    music: { id: "music-1", revision: 2, start: 4, volume: 25, loop: true }
  };
}
describe("图文批量编辑配方", () => {
  it("不同图数分别计算预览及保存时长，自动结束和音乐起点不受首条时长影响", () => {
    const selected = { ...recipe(), watermark: { libraryId: "logo", settings: defaultArchiveWatermarkSettings() } };
    for (const count of [1, 3, 7]) {
      const item = photosWithCount(count);
      const preview = imageBatchInput(item, selected, "draft-preview", "preview");
      const save = imageBatchInput(item, selected, "draft-save");
      expect(preview.duration).toBe(count * 3);
      expect(save.duration).toBe(count * 3);
      expect(preview.input).toMatchObject({
        mode: "preview",
        previewFullLength: true,
        previewStartSeconds: 0,
        watermark: { settings: { endSeconds: null } },
        settings: { musicStartSeconds: 4, loop: true }
      });
      expect(save.input).toMatchObject({ mode: "save", watermark: { settings: { endSeconds: null } } });
      expect(save.input.previewFullLength).toBeUndefined();
    }
  });
  it("按原图 index 生成附加视频，排除截帧；输入保持不变", () => {
    const item = photos();
    item.media.reverse();
    item.media.push({ ...item.media[0], id: "frame-1", frameSourceMediaId: "video-1" });
    const before = structuredClone(item);
    const result = imageBatchInput(item, recipe());
    expect(result.mediaId).toBe("image-0");
    expect(result.input).toMatchObject({
      mode: "save",
      revision: 0,
      musicId: "music-1",
      musicRevision: 2,
      useSavedMusic: false,
      settings: { originalVolume: 100, musicVolume: 25, musicStartSeconds: 4, loop: true },
      slideshow: { secondsPerImage: 3, aspect: "portrait", images: [{ id: "image-0" }, { id: "image-1" }] }
    });
    expect(result.input.watermark).toBeUndefined();
    expect(item).toEqual(before);
  });
  it("选择同一组原图的最新派生视频，水印编辑保留配乐及原声参数，不重复生成图集", () => {
    const item = photos();
    const video: ContentArchiveMedia = {
      ...item.media[0],
      id: "video-1",
      kind: "video",
      index: 2,
      durationMs: 6000,
      derivedFromImages: item.media.map(({ id, checksum }) => ({ id, checksum })),
      audioEdit: {
        revision: 3,
        original,
        settings: { ...settings, originalVolume: 65, musicStartSeconds: 13 },
        updatedAt: "2026-11-04T00:00:00Z",
        music: { ...original, fileName: "music.mp3", title: "已存音乐" },
        watermark: {
          file: { ...original, fileName: "logo.png" },
          width: 10,
          height: 5,
          settings: defaultArchiveWatermarkSettings()
        }
      }
    };
    item.media.push(video, {
      ...video,
      id: "older-video",
      index: 3,
      audioEdit: { ...video.audioEdit!, updatedAt: "2026-11-03T00:00:00Z" }
    });
    const result = imageBatchInput(
      item,
      {
        ...recipe(),
        kind: "watermark",
        music: undefined,
        watermark: { libraryId: "library-logo", settings: defaultArchiveWatermarkSettings() }
      },
      "draftid12345"
    );
    expect(result.mediaId).toBe("video-1");
    expect(result.input).toMatchObject({
      revision: 3,
      useSavedMusic: true,
      settings: { originalVolume: 65, musicStartSeconds: 13 },
      watermark: { draftId: "draftid12345", settings: { endSeconds: null } }
    });
    expect(result.input.slideshow).toBeUndefined();
    expect(result.input.musicId).toBeUndefined();
    const audio = imageBatchInput(item, recipe());
    expect(audio.input.watermark).toBeUndefined();
    expect(audio.input.settings.originalVolume).toBe(65);
    expect(audio.input.slideshow).toBeUndefined();
  });
  it("不使用无关视频或已变化原图的派生视频", () => {
    const item = photos();
    item.media.push({
      ...item.media[0],
      id: "other-video",
      kind: "video",
      derivedFromImages: [{ id: "image-0", checksum: "f".repeat(64) }]
    });
    expect(imageBatchTarget(item).existing).toBe(false);
  });
  it("已有图集视频使用各自实际时长，不按新图集停留秒数重算；固定时间越界仍拒绝", () => {
    const item = photos();
    item.media.push({
      ...item.media[0],
      id: "existing-video",
      kind: "video",
      durationMs: 11734,
      derivedFromImages: item.media.map(({ id, checksum }) => ({ id, checksum }))
    });
    const selected: ImageBatchRecipe = {
      ...recipe(),
      secondsPerImage: 0.5,
      watermark: { libraryId: "logo", settings: defaultArchiveWatermarkSettings() }
    };
    for (const mode of ["preview", "save"] as const) {
      const result = imageBatchInput(item, selected, "independent-draft", mode);
      expect(result.duration).toBe(11.734);
      expect(result.mediaId).toBe("existing-video");
      expect(result.input.slideshow).toBeUndefined();
      expect(result.input.watermark?.settings.endSeconds).toBeNull();
    }
    selected.watermark!.settings.endSeconds = 12;
    expect(() => imageBatchInput(item, selected)).toThrow("视频时长");
  });
  it("拒绝非图文、空图集、超100原图、缺素材以及超出各自时长的水印", () => {
    expect(() => imageBatchTarget(archiveFixture())).toThrow("仅支持图文");
    expect(() => imageBatchTarget(photosWithCount(0))).toThrow("1～100");
    expect(() => imageBatchTarget(photosWithCount(101))).toThrow("1～100");
    expect(() => imageBatchInput(photos(), { ...recipe(), music: undefined })).toThrow("选择音频");
    expect(() => imageBatchInput(photos(), { ...recipe(), kind: "watermark" })).toThrow("选择水印");
    expect(() =>
      imageBatchInput(photos(), {
        ...recipe(),
        kind: "watermark",
        watermark: { libraryId: "logo", settings: { ...defaultArchiveWatermarkSettings(), endSeconds: 7 } }
      })
    ).toThrow("视频时长");
  });
});
function photosWithCount(count: number) {
  const item = photos();
  item.media = Array.from({ length: count }, (_, index) => ({ ...item.media[0], id: `image-${index}`, index }));
  return item;
}
