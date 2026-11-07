/** 批量图文编辑复用单条视频编辑协议；同一组原图优先更新已有图集视频。 */
import {
  defaultArchiveAudioSettings,
  watermarkTimingError,
  type ArchiveVideoEditInput,
  type ArchiveWatermarkSettings,
  type ContentArchiveItem
} from "@toolbox/shared/archive";

export type ImageBatchRecipe = {
  kind: "watermark" | "audio";
  secondsPerImage: number;
  aspect: "portrait" | "landscape" | "square";
  watermark?: { settings: ArchiveWatermarkSettings; file?: File; libraryId?: string };
  music?: ({ id: string; revision: number } | { source: "original" }) & {
    volume: number;
    start: number;
    loop: boolean;
  };
};

export function imageBatchTarget(item: ContentArchiveItem) {
  if (item.type !== "image") throw new Error("仅支持图文归档，已跳过其他类型");
  const images = item.media
    .filter((media) => media.kind === "image" && !media.frameSourceMediaId)
    .sort((a, b) => a.index - b.index);
  if (!images.length || images.length > 100) throw new Error("每条图文需要 1～100 张原图");
  const videos = item.media.filter(
    (media) =>
      media.kind === "video" &&
      media.derivedFromImages?.length === images.length &&
      media.derivedFromImages.every(
        (source, index) => source.id === images[index].id && source.checksum === images[index].checksum
      )
  );
  videos.sort(
    (a, b) => (b.audioEdit?.updatedAt ?? "").localeCompare(a.audioEdit?.updatedAt ?? "") || b.index - a.index
  );
  return { images, media: videos[0] ?? images[0], existing: videos.length > 0 };
}

export function imageBatchInput(
  item: ContentArchiveItem,
  recipe: ImageBatchRecipe,
  draftId?: string,
  mode: "save" | "preview" = "save"
) {
  const { images, media, existing } = imageBatchTarget(item);
  const duration = existing ? (media.durationMs ?? 0) / 1000 : images.length * recipe.secondsPerImage;
  const input: ArchiveVideoEditInput = {
    mode,
    ...(mode === "preview" ? { previewFullLength: true, previewStartSeconds: 0 } : {}),
    revision: media.audioEdit?.revision ?? 0,
    checksum: media.checksum,
    useSavedMusic: Boolean(media.audioEdit?.music),
    settings: { ...(media.audioEdit?.settings ?? defaultArchiveAudioSettings()) },
    ...(!existing
      ? {
          slideshow: {
            images: images.map(({ id, checksum }) => ({ id, checksum })),
            secondsPerImage: recipe.secondsPerImage,
            aspect: recipe.aspect
          }
        }
      : {})
  };
  if (recipe.kind === "watermark" || recipe.watermark) {
    if (!recipe.watermark || (!recipe.watermark.file && !recipe.watermark.libraryId))
      throw new Error("请先选择水印图片");
    const settings = JSON.parse(JSON.stringify(recipe.watermark.settings)) as ArchiveWatermarkSettings;
    const error = watermarkTimingError(settings, duration);
    if (error) throw new Error(error);
    input.watermark = { ...(draftId ? { draftId } : {}), settings };
  }
  if (recipe.kind === "audio" || recipe.music) {
    if (!recipe.music) throw new Error("请先选择音频素材");
    if ("source" in recipe.music) {
      const original = item.media.find((entry) => entry.kind === "audio");
      if (!original) throw new Error("该作品没有已归档的原配乐，请刷新作品补充或选择背景音乐库中的音乐");
      input.sourceMusicId = original.id;
      input.sourceMusicChecksum = original.checksum;
    } else {
      input.musicId = recipe.music.id;
      input.musicRevision = recipe.music.revision;
    }
    input.useSavedMusic = false;
    Object.assign(input.settings, {
      musicVolume: recipe.music.volume,
      musicStartSeconds: recipe.music.start,
      loop: recipe.music.loop
    });
    // 未设置水印时不传 watermark，保留该视频已保存的水印及其轨迹。
  }
  return { mediaId: media.id, input, duration };
}
