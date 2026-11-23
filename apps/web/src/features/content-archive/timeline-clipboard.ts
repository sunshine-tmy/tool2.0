import {
  archiveClipDuration,
  archiveCutStarts,
  type ArchiveCutClip,
  type ArchiveStudio
} from "@toolbox/shared/archive";

export type TimelineClipboard = Pick<ArchiveStudio, "sources" | "subtitles" | "musicTracks" | "watermarks"> & {
  clips: ArchiveCutClip[];
  origin: number;
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function copyTimeline(
  clips: ArchiveCutClip[],
  studio: ArchiveStudio,
  selected: string[]
): TimelineClipboard | undefined {
  const ids = new Set(selected),
    starts = archiveCutStarts(clips);
  const video = clips.flatMap((clip, i) => (ids.has(clip.id) && !clip.locked ? [{ ...clip, at: starts[i] }] : []));
  const subtitles = studio.subtitles.filter((entry) => ids.has(entry.id) && !entry.locked);
  const musicTracks = studio.musicTracks.filter((entry) => ids.has(entry.id) && !entry.locked);
  const watermarks = (studio.watermarks ?? []).filter((entry) => ids.has(entry.id) && !entry.locked);
  if (!video.length && !subtitles.length && !musicTracks.length && !watermarks.length) return;
  return clone({
    clips: video,
    subtitles,
    musicTracks,
    watermarks,
    sources: studio.sources.filter((source) => video.some((clip) => clip.sourceId === source.id)),
    origin: Math.min(
      ...video.map((clip) => clip.at!),
      ...subtitles.map((entry) => entry.start),
      ...musicTracks.map((entry) => entry.start),
      ...watermarks.map((entry) => entry.start)
    )
  });
}

/** 按指针粘贴；冲突时整组插入新轨道，保留组内时间差和上下层级。 */
export function pasteTimeline(
  clipboard: TimelineClipboard,
  at: number,
  clips: ArchiveCutClip[],
  studio: ArchiveStudio,
  newId: () => string
) {
  const data = clone(clipboard),
    next = clone(clips),
    composition = clone(studio);
  const delta = at - data.origin;
  const copied = [
    ...(data.watermarks ?? []).map((entry) => ({
      entry,
      kind: "watermark",
      at: entry.start,
      end: entry.end,
      lane: entry.lane ?? 0
    })),
    ...data.clips.map((entry) => ({
      entry,
      kind: "video",
      at: entry.at!,
      end: entry.at! + archiveClipDuration(entry),
      lane: entry.lane ?? 1
    })),
    ...data.subtitles.map((entry) => ({
      entry,
      kind: "subtitle",
      at: entry.start,
      end: entry.end,
      lane: entry.lane ?? 0
    })),
    ...data.musicTracks.map((entry) => ({
      entry,
      kind: "music",
      at: entry.start,
      end: entry.end,
      lane: entry.lane ?? 2
    }))
  ];
  const starts = archiveCutStarts(next);
  const existing = [
    ...(composition.watermarks ?? []).map((entry) => ({
      entry,
      kind: "watermark",
      at: entry.start,
      end: entry.end,
      lane: entry.lane ?? 0
    })),
    ...next.map((entry, i) => ({
      entry,
      kind: "video",
      at: starts[i],
      end: starts[i] + archiveClipDuration(entry),
      lane: entry.lane ?? 1
    })),
    ...composition.subtitles.map((entry) => ({
      entry,
      kind: "subtitle",
      at: entry.start,
      end: entry.end,
      lane: entry.lane ?? 0
    })),
    ...composition.musicTracks.map((entry) => ({
      entry,
      kind: "music",
      at: entry.start,
      end: entry.end,
      lane: entry.lane ?? 2
    }))
  ];
  const conflict = copied.some((node) =>
    existing.some(
      (other) =>
        other.lane === node.lane &&
        (other.entry.locked ||
          other.kind !== node.kind ||
          (node.at + delta < other.end - 1e-7 && node.end + delta > other.at + 1e-7))
    )
  );
  const lanes = [...new Set(copied.map((node) => node.lane))].sort((a, b) => a - b);
  if (conflict)
    for (const node of existing) node.entry.lane = node.lane >= lanes[0] ? node.lane + lanes.length : node.lane;
  for (const node of copied) {
    node.entry.id = newId();
    node.entry.lane = conflict ? lanes[0] + lanes.indexOf(node.lane) : node.lane;
  }
  for (const clip of data.clips) clip.at = clip.at! + delta;
  for (const entry of [...data.subtitles, ...data.musicTracks, ...(data.watermarks ?? [])]) {
    entry.start += delta;
    entry.end += delta;
  }
  for (const source of data.sources)
    if (!composition.sources.some((entry) => entry.id === source.id)) composition.sources.push(source);
  next.push(...data.clips);
  composition.subtitles.push(...data.subtitles);
  composition.musicTracks.push(...data.musicTracks);
  (composition.watermarks ??= []).push(...(data.watermarks ?? []).map((mark) => ({ ...mark, followEnd: false })));
  return { clips: next, studio: composition, selected: copied.map((node) => node.entry.id) };
}
