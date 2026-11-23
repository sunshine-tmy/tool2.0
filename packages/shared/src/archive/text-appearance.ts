import type { ArchiveSubtitle } from "./video-studio";
/** Optional appearance values keep older recipes visually compatible. */
export function archiveTextAppearance(cue: Partial<ArchiveSubtitle>) {
  return {
    color: cue.color ?? "#ffffff",
    outlineColor: cue.outlineColor ?? "#000000",
    outlineWidth: cue.outlineWidth ?? 2,
    shadowColor: cue.shadowColor ?? "#000000",
    shadowOpacity: cue.shadowOpacity ?? 0,
    shadowX: cue.shadowX ?? 0,
    shadowY: cue.shadowY ?? 0,
    backgroundColor: cue.backgroundColor ?? "#000000",
    backgroundOpacity: cue.backgroundOpacity ?? 0,
    backgroundPadding: cue.backgroundPadding ?? 6
  };
}
export type ArchiveTextAppearance = ReturnType<typeof archiveTextAppearance>;
