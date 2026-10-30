import type { ArchiveEditFile, ContentArchiveMedia } from "@toolbox/shared";

export function mediaFile(media: ContentArchiveMedia): ArchiveEditFile {
  return { fileName: media.fileName, mimeType: media.mimeType, size: media.size, checksum: media.checksum };
}
/** 当前成品、原片和配乐均属于同一归档；同一路径只计费一次。 */
export function archiveMediaAssets(media: ContentArchiveMedia, includePending = true): ArchiveEditFile[] {
  const files = [
    mediaFile(media),
    ...(media.audioEdit
      ? [
          media.audioEdit.original,
          ...(media.audioEdit.music ? [media.audioEdit.music] : []),
          ...(media.audioEdit.watermark ? [media.audioEdit.watermark.file] : []),
          ...(includePending ? (media.audioEdit.pendingFiles ?? []) : [])
        ]
      : [])
  ];
  const names = new Map<string, ArchiveEditFile>();
  for (const file of files) {
    const key = file.fileName.toLowerCase();
    const previous = names.get(key);
    if (previous && (previous.checksum !== file.checksum || previous.size !== file.size))
      throw new Error("ARCHIVE_ASSET_CONFLICT");
    names.set(key, { fileName: file.fileName, mimeType: file.mimeType, size: file.size, checksum: file.checksum });
  }
  return [...names.values()];
}
export function archiveMediaBytes(media: readonly ContentArchiveMedia[]) {
  return media.reduce((sum, entry) => sum + archiveMediaAssets(entry).reduce((bytes, file) => bytes + file.size, 0), 0);
}
