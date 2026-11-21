import { Value } from "@sinclair/typebox/value";
import { computed, ref, watch, onScopeDispose } from "vue";
import {
  archiveProjectDuration,
  archiveVisibleClip,
  archiveCutStarts,
  defaultArchiveStudio,
  ArchiveStudioSchema,
  ArchiveCutClipSchema,
  type ArchiveStudio,
  type ArchiveStudioSource,
  archiveClipDuration,
  defaultArchiveFrame,
  type ArchiveFrame,
  type ArchiveCutClip,
  type ArchiveCutDraft,
  type ContentArchiveMedia
} from "@toolbox/shared/archive";
import { videoEditApi } from "./video-edit-api";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const cutClipId = () =>
  `clip_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
export function useArchiveRoughCut(
  itemId: () => string,
  media: () => ContentArchiveMedia | undefined,
  video: () => HTMLVideoElement | undefined,
  enabled: () => boolean,
  sourceUrl: () => string,
  originalVolume: () => number = () => 100,
  studioUrl: (source: ArchiveStudioSource) => string = () => sourceUrl(),
  switchSource: (url: string) => void = () => {}
) {
  const clips = ref<ArchiveCutClip[]>([]),
    selected = ref<string[]>([]),
    time = ref(0),
    zoom = ref(1),
    snapping = ref(true);
  const sourceDuration = ref(0),
    fps = ref(30),
    loaded = ref(false),
    loading = ref(false),
    error = ref(""),
    draftStatus = ref("");
  const studio = ref<ArchiveStudio>(defaultArchiveStudio());
  const activeUrl = ref("");
  let wantPlay = false;
  const sourceOf = (clip?: ArchiveCutClip) => studio.value.sources.find((entry) => entry.id === clip?.sourceId);
  const fpsFor = (clip?: ArchiveCutClip) => sourceOf(clip)?.fps ?? fps.value;
  const durationFor = (clip?: ArchiveCutClip) => sourceOf(clip)?.duration ?? sourceDuration.value;
  const sourceUrls = computed(() =>
    Object.fromEntries(studio.value.sources.map((entry) => [entry.id, studioUrl(entry)]))
  );
  const frameSettings = ref<ArchiveFrame>(defaultArchiveFrame());
  const sourceWidth = ref(0),
    sourceHeight = ref(0);
  const duration = computed(() => archiveProjectDuration(clips.value, studio.value));
  const visibleIndex = ref(-1);
  const isGap = computed(() => visibleIndex.value < 0);
  const undo = ref<ArchiveCutDraft[]>([]),
    redo = ref<ArchiveCutDraft[]>([]);
  const clipboard = ref<ArchiveCutClip[]>([]);
  const clipboardSources = ref<ArchiveStudioSource[]>([]);
  const copiedSubtitles = ref<ArchiveStudio["subtitles"]>([]);
  const copiedMusic = ref<ArchiveStudio["musicTracks"]>([]);
  const canPaste = computed(
    () => loaded.value && clipboard.value.length + copiedSubtitles.value.length + copiedMusic.value.length > 0
  );
  const activeIndex = computed(() => clips.value.findIndex((clip) => selected.value.includes(clip.id)));
  const starts = computed(() => archiveCutStarts(clips.value));
  function videoEligible(clip: ArchiveCutClip, index: number) {
    const edge = 0.5 / (fpsFor(clip) * (clip.speed ?? 1));
    return (
      selected.value.includes(clip.id) &&
      time.value > starts.value[index] + edge &&
      time.value < starts.value[index] + archiveClipDuration(clip) - edge
    );
  }
  const timedEligible = (entry: { id: string; start: number; end: number }) =>
    selected.value.includes(entry.id) && time.value > entry.start + 0.005 && time.value < entry.end - 0.005;
  const canTrim = computed(
    () =>
      clips.value.some(videoEligible) ||
      studio.value.subtitles.some(timedEligible) ||
      studio.value.musicTracks.some(timedEligible)
  );
  let generation = 0,
    scope = new AbortController(),
    saveTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingSave: Promise<void> = Promise.resolve(),
    revision = 0,
    playingIndex = 0,
    frame: number | undefined;
  let gesture: ArchiveCutDraft | undefined;
  let seekFrame: number | undefined, pendingSeek: number | undefined;
  function snapshot(): ArchiveCutDraft {
    const current = media();
    return {
      checksum: current?.checksum ?? "",
      revision: current?.audioEdit?.revision ?? 0,
      clips: clone(clips.value),
      playhead: time.value,
      selected: [...selected.value],
      zoom: zoom.value,
      frame: clone(frameSettings.value),
      studio: clone(studio.value)
    };
  }
  function scheduleSave() {
    if (!loaded.value) return;
    draftStatus.value = "正在保存草稿…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flush(), 500);
  }
  async function flush() {
    clearTimeout(saveTimer);
    if (!loaded.value || !media()) return;
    const data = snapshot(),
      token = generation,
      serial = ++revision;
    pendingSave = pendingSave
      .catch(() => {})
      .then(async () => {
        if (token !== generation) return;
        try {
          await videoEditApi.saveCutDraft(itemId(), media()!.id, data, scope.signal);
          if (token === generation && serial === revision) {
            draftStatus.value = "粗剪草稿已保存";
            error.value = "";
          }
        } catch (e) {
          if (token === generation && !isApiErrorCancelled(e)) {
            draftStatus.value = "草稿保存失败";
            error.value = formatApiError(e);
          }
        }
      });
    await pendingSave;
  }
  function stop() {
    wantPlay = false;
    video()?.pause();
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }
  function reset() {
    stop();
    if (seekFrame !== undefined) cancelAnimationFrame(seekFrame);
    seekFrame = undefined;
    pendingSeek = undefined;
    clearTimeout(saveTimer);
    scope.abort();
    scope = new AbortController();
    generation++;
    loaded.value = false;
    loading.value = false;
    studio.value = defaultArchiveStudio();
    activeUrl.value = "";
    frameSettings.value = defaultArchiveFrame();
    sourceWidth.value = 0;
    sourceHeight.value = 0;
    clipboard.value = [];
    copiedSubtitles.value = [];
    copiedMusic.value = [];
    visibleIndex.value = -1;
    clipboardSources.value = [];
    clips.value = [];
    selected.value = [];
    time.value = 0;
    undo.value = [];
    redo.value = [];
    sourceDuration.value = 0;
    error.value = "";
    draftStatus.value = "";
    gesture = undefined;
  }
  async function load() {
    if (loaded.value || loading.value || !media()) return;
    const token = generation;
    loading.value = true;
    error.value = "";
    try {
      const current = media()!;
      const result = await videoEditApi.cutSource(itemId(), current.id, scope.signal);
      if (token !== generation) return;
      sourceDuration.value = result.duration;
      fps.value = result.fps;
      sourceWidth.value = result.width ?? current.audioEdit?.originalWidth ?? current.width ?? 0;
      sourceHeight.value = result.height ?? current.audioEdit?.originalHeight ?? current.height ?? 0;
      const draft = result.draft;
      studio.value = clone(draft?.studio ?? current.audioEdit?.studio ?? defaultArchiveStudio());
      frameSettings.value = clone(result.draft?.frame ?? current.audioEdit?.frame ?? defaultArchiveFrame());
      const saved = current.audioEdit?.cut;
      const restored = clone(draft?.clips ?? saved ?? [{ id: cutClipId(), start: 0, end: result.duration }]);
      const positions = archiveCutStarts(restored);
      clips.value = restored.map((clip, i) => ({ ...clip, at: clip.at ?? positions[i], lane: clip.lane ?? 1 }));
      studio.value.subtitles = studio.value.subtitles.map((cue) => ({ ...cue, lane: cue.lane ?? 0 }));
      studio.value.musicTracks = studio.value.musicTracks.map((track, i) => ({ ...track, lane: track.lane ?? 2 + i }));
      time.value = Math.min(draft?.playhead ?? 0, duration.value);
      selected.value = draft?.selected ?? [];
      zoom.value = draft?.zoom ?? 1;
      loaded.value = true;
      draftStatus.value = draft ? "已恢复粗剪草稿" : "";
      if (enabled()) seek(time.value);
    } catch (e) {
      if (token === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
    } finally {
      if (token === generation) loading.value = false;
    }
  }
  let anchorTime = 0,
    anchorWall = 0;
  function locate(value: number) {
    const position = Math.max(0, Math.min(duration.value, value));
    const index = archiveVisibleClip(clips.value, position >= duration.value ? Math.max(0, position - 1e-6) : position);
    const clip = clips.value[index];
    return {
      index,
      source: clip
        ? clip.start + Math.min(clip.end - clip.start, Math.max(0, position - starts.value[index]) * (clip.speed ?? 1))
        : 0
    };
  }
  function requestVideoPosition() {
    const target = locate(time.value);
    playingIndex = target.index;
    visibleIndex.value = target.index;
    if (target.index < 0) {
      pendingSeek = undefined;
      video()?.pause();
      return;
    }
    pendingSeek = target.source;
    const source = sourceOf(clips.value[target.index]);
    const nextUrl = source ? studioUrl(source) : sourceUrl();
    if (activeUrl.value !== nextUrl || video()?.getAttribute("src") !== nextUrl) {
      activeUrl.value = nextUrl;
      video()?.pause();
      switchSource(nextUrl);
    }
    if (seekFrame === undefined)
      seekFrame = requestAnimationFrame(() => {
        seekFrame = undefined;
        const element = video();
        if (
          element &&
          element.readyState >= 1 &&
          element.getAttribute("src") === activeUrl.value &&
          pendingSeek !== undefined &&
          playingIndex >= 0
        ) {
          element.playbackRate = clips.value[playingIndex]?.speed ?? 1;
          element.preservesPitch = true;
          element.currentTime = pendingSeek;
          pendingSeek = undefined;
          if (wantPlay) void element.play().catch(() => {});
        }
      });
  }
  function seek(value: number, fromClock = false) {
    time.value = Math.max(0, Math.min(duration.value, value));
    if (!fromClock) {
      anchorTime = time.value;
      anchorWall = performance.now();
    }
    requestVideoPosition();
  }
  function sync() {
    if (!enabled() || !loaded.value) return;
    if (wantPlay) {
      time.value = Math.min(duration.value, anchorTime + (performance.now() - anchorWall) / 1000);
      if (time.value >= duration.value) {
        stop();
        requestVideoPosition();
        return;
      }
    }
    const target = locate(time.value),
      element = video();
    if (target.index !== visibleIndex.value) requestVideoPosition();
    if (!element || target.index < 0 || element.getAttribute("src") !== activeUrl.value || element.readyState < 1)
      return;
    const clip = clips.value[target.index];
    element.playbackRate = clip.speed ?? 1;
    element.preservesPitch = true;
    const position = Math.max(0, time.value - starts.value[target.index]),
      length = archiveClipDuration(clip);
    const fadeIn = Math.min(clip.fadeIn ?? 0, length / 2),
      fadeOut = Math.min(clip.fadeOut ?? 0, length / 2);
    const gain = Math.min(1, fadeIn ? position / fadeIn : 1, fadeOut ? Math.max(0, length - position) / fadeOut : 1);
    element.volume = Math.max(0, Math.min(1, ((((clip.volume ?? 100) / 100) * originalVolume()) / 100) * gain));
    if (
      wantPlay &&
      !element.seeking &&
      pendingSeek === undefined &&
      Math.abs(element.currentTime - target.source) > 0.15
    )
      element.currentTime = target.source;
    if (wantPlay && element.paused && !element.seeking && pendingSeek === undefined)
      void element.play().catch(() => {});
  }
  function tick() {
    frame = undefined;
    sync();
    if (wantPlay && enabled()) frame = requestAnimationFrame(tick);
  }
  function onReady() {
    if (enabled() && loaded.value) requestVideoPosition();
  }
  function onPlay() {
    if (!enabled() || !loaded.value) return;
    if (!wantPlay) {
      video()?.pause();
      return;
    }
    if (frame === undefined) frame = requestAnimationFrame(tick);
  }
  function onEnded() {
    if (enabled() && wantPlay) sync();
  }
  function togglePlay() {
    if (!loaded.value || duration.value <= 0) return;
    if (wantPlay) {
      sync();
      stop();
    } else {
      if (time.value >= duration.value) seek(0);
      wantPlay = true;
      anchorTime = time.value;
      anchorWall = performance.now();
      requestVideoPosition();
      if (frame === undefined) frame = requestAnimationFrame(tick);
    }
  }
  function restoreSnapshot(value: ArchiveCutDraft) {
    stop();
    clips.value = clone(value.clips);
    frameSettings.value = clone(value.frame ?? defaultArchiveFrame());
    studio.value = clone(value.studio ?? defaultArchiveStudio());
    selected.value = [...value.selected];
    seek(value.playhead);
    scheduleSave();
  }
  function begin() {
    stop();
    gesture = snapshot();
  }
  function commit(next: ArchiveCutClip[], frame = frameSettings.value, composition = studio.value): boolean {
    if (next.length > 2000 || archiveProjectDuration(next, composition) > 7200) {
      gesture = undefined;
      error.value = next.length > 2000 ? "单次粗剪最多支持 2000 个片段" : "剪辑后视频最长支持 2 小时";
      return false;
    }
    next = clone(next);
    composition = clone(composition);
    const entries = [
      ...next.map((clip) => ({
        entry: clip,
        kind: "video",
        at: clip.at ?? 0,
        end: (clip.at ?? 0) + archiveClipDuration(clip),
        lane: clip.lane ?? 1
      })),
      ...composition.subtitles.map((cue) => ({
        entry: cue,
        kind: "subtitle",
        at: cue.start,
        end: cue.end,
        lane: cue.lane ?? 0
      })),
      ...composition.musicTracks.map((track) => ({
        entry: track,
        kind: "music",
        at: track.start,
        end: track.end,
        lane: track.lane ?? 2
      }))
    ];
    const placed: typeof entries = [];
    for (const node of entries) {
      if (
        placed.some(
          (other) =>
            other.lane === node.lane &&
            (other.kind !== node.kind || (node.at < other.end - 1e-7 && node.end > other.at + 1e-7))
        )
      )
        node.lane = Math.max(-1, ...entries.map((other) => other.lane), ...placed.map((other) => other.lane)) + 1;
      placed.push(node);
    }
    const lanes = [...new Set(placed.map((node) => node.lane))].sort((a, b) => a - b);
    if (lanes.length > 2000) {
      gesture = undefined;
      error.value = "轨道数量超过上限";
      return false;
    }
    for (const node of placed) node.entry.lane = lanes.indexOf(node.lane);
    composition.lanes = Math.max(1, lanes.length);
    const before = gesture ?? snapshot();
    gesture = undefined;
    if (
      next.some(
        (clip) =>
          !Value.Check(ArchiveCutClipSchema, clip) ||
          clip.end <= clip.start ||
          clip.end >
            (composition.sources.find((source) => source.id === clip.sourceId)?.duration ?? sourceDuration.value) +
              0.001
      )
    ) {
      gesture = undefined;
      error.value = "片段时间或轨道位置无效，请检查是否超出原片范围";
      return false;
    }
    if (
      !Value.Check(ArchiveStudioSchema, composition) ||
      composition.subtitles.some((cue) => cue.end <= cue.start) ||
      composition.musicTracks.some((track) => track.end <= track.start)
    ) {
      error.value = "字幕、配乐或拼接素材参数无效，请检查时间范围与数量";
      return false;
    }
    if (next.some((clip) => clip.sourceId && !composition.sources.some((source) => source.id === clip.sourceId))) {
      error.value = "片段来源素材不存在";
      return false;
    }
    if (
      JSON.stringify(before.clips) === JSON.stringify(next) &&
      JSON.stringify(before.frame) === JSON.stringify(frame) &&
      JSON.stringify(before.studio) === JSON.stringify(composition)
    )
      return false;
    stop();
    error.value = "";
    undo.value.push(before);
    if (undo.value.length > 100) undo.value.shift();
    redo.value = [];
    clips.value = clone(next);
    frameSettings.value = clone(frame);
    studio.value = clone(composition);
    const ids = new Set([...next, ...composition.subtitles, ...composition.musicTracks].map((entry) => entry.id));
    selected.value = selected.value.filter((id) => ids.has(id));
    seek(Math.min(time.value, duration.value));
    scheduleSave();
    void flush();
    return true;
  }
  function cancelGesture() {
    if (gesture) {
      const previous = gesture;
      gesture = undefined;
      restoreSnapshot(previous);
    }
  }
  function undoEdit() {
    const previous = undo.value.pop();
    if (previous) {
      redo.value.push(snapshot());
      restoreSnapshot(previous);
    }
  }
  function redoEdit() {
    const next = redo.value.pop();
    if (next) {
      undo.value.push(snapshot());
      restoreSnapshot(next);
    }
  }
  function batchEdit(mode: "split" | "left" | "right") {
    if (!canTrim.value) return;
    const composition = clone(studio.value);
    const next = clips.value.flatMap((clip, index): ArchiveCutClip[] => {
      if (!videoEligible(clip, index)) return [clone(clip)];
      const source = clip.start + (time.value - starts.value[index]) * (clip.speed ?? 1);
      if (mode === "left") return [{ ...clone(clip), start: source, at: time.value }];
      if (mode === "right") return [{ ...clone(clip), end: source }];
      return [
        { ...clone(clip), end: source, transition: undefined, fadeOut: 0 },
        { ...clone(clip), id: cutClipId(), start: source, at: time.value, fadeIn: 0 }
      ];
    });
    function edit<
      T extends { id: string; start: number; end: number; sourceStart?: number; fadeIn?: number; fadeOut?: number }
    >(list: T[]): T[] {
      return list.flatMap((entry): T[] => {
        if (!timedEligible(entry)) return [entry];
        const right = { ...clone(entry), start: time.value };
        if (right.sourceStart !== undefined) right.sourceStart += time.value - entry.start;
        if (mode === "left") return [right];
        const left = { ...entry, end: time.value };
        if (mode === "right") return [left];
        right.id = cutClipId();
        if (right.fadeIn !== undefined) right.fadeIn = 0;
        if (left.fadeOut !== undefined) left.fadeOut = 0;
        return [left, right];
      });
    }
    composition.subtitles = edit(composition.subtitles);
    composition.musicTracks = edit(composition.musicTracks);
    const previousIds = new Set(
      [...clips.value, ...studio.value.subtitles, ...studio.value.musicTracks].map((entry) => entry.id)
    );
    if (commit(next, frameSettings.value, composition)) {
      selected.value = [
        ...selected.value,
        ...[...next, ...composition.subtitles, ...composition.musicTracks]
          .filter((entry) => !previousIds.has(entry.id))
          .map((entry) => entry.id)
      ];
      scheduleSave();
    }
  }
  function split() {
    batchEdit("split");
  }
  function trim(side: "left" | "right") {
    batchEdit(side);
  }
  function copySelection() {
    if (!selected.value.length) return;
    clipboard.value = clone(clips.value.filter((clip) => selected.value.includes(clip.id)));
    copiedSubtitles.value = clone(studio.value.subtitles.filter((cue) => selected.value.includes(cue.id)));
    copiedMusic.value = clone(studio.value.musicTracks.filter((track) => selected.value.includes(track.id)));
    clipboardSources.value = clone(
      studio.value.sources.filter((source) => clipboard.value.some((clip) => clip.sourceId === source.id))
    );
  }
  function paste() {
    if (!canPaste.value) return;
    const origin = Math.min(
      ...clipboard.value.map((clip) => clip.at ?? 0),
      ...copiedSubtitles.value.map((cue) => cue.start),
      ...copiedMusic.value.map((track) => track.start)
    );
    const offset = time.value - origin;
    const copied = clipboard.value.map((clip) => ({ ...clone(clip), id: cutClipId(), at: (clip.at ?? 0) + offset }));
    const cues = copiedSubtitles.value.map((cue) => ({
      ...clone(cue),
      id: cutClipId(),
      start: cue.start + offset,
      end: cue.end + offset
    }));
    const tracks = copiedMusic.value.map((track) => ({
      ...clone(track),
      id: cutClipId(),
      start: track.start + offset,
      end: track.end + offset
    }));
    const composition = clone(studio.value);
    composition.subtitles.push(...cues);
    composition.musicTracks.push(...tracks);
    for (const source of clipboardSources.value)
      if (!composition.sources.some((entry) => entry.id === source.id)) composition.sources.push(clone(source));
    if (!commit([...clips.value, ...copied], frameSettings.value, composition)) return;
    selected.value = [...copied, ...cues, ...tracks].map((entry) => entry.id);
    scheduleSave();
  }
  function duplicate() {
    if (!selected.value.length) return;
    copySelection();
    const end = Math.max(
      ...clipboard.value.map((clip) => (clip.at ?? 0) + archiveClipDuration(clip)),
      ...copiedSubtitles.value.map((cue) => cue.end),
      ...copiedMusic.value.map((track) => track.end)
    );
    const previous = time.value;
    time.value = end;
    paste();
    seek(previous);
  }
  function updateClip(id: string, changes: Partial<ArchiveCutClip>) {
    const next = clips.value.map((clip) => (clip.id === id ? { ...clip, ...changes, id } : clip));
    if (
      next.some(
        (clip) => clip.start < 0 || clip.end > durationFor(clip) + 0.001 || clip.end - clip.start < 0.5 / fpsFor(clip)
      )
    ) {
      error.value = "起点须早于终点，且不能超出原片范围";
      return;
    }
    commit(next);
  }
  function updateStudio(value: ArchiveStudio) {
    commit(clips.value, frameSettings.value, value);
  }
  function appendSource(source: ArchiveStudioSource) {
    const value = clone(studio.value);
    const known = value.sources.find(
      (entry) =>
        entry.itemId === source.itemId && entry.mediaId === source.mediaId && entry.checksum === source.checksum
    );
    if (!known) value.sources.push(source);
    const id = cutClipId();
    const next = [
      ...clips.value,
      { id, sourceId: known?.id ?? source.id, start: 0, end: source.duration, at: duration.value, lane: 1 }
    ];
    if (commit(next, frameSettings.value, value)) {
      selected.value = [id];
      seek(starts.value[clips.value.length - 1]);
    }
  }
  function applyAnalysis(id: string, boundaries: number[], silence?: Array<{ start: number; end: number }>) {
    const index = clips.value.findIndex((clip) => clip.id === id);
    if (index < 0) return;
    const clip = clips.value[index],
      frame = 1 / fpsFor(clip);
    const points = [clip.start];
    for (const point of [...new Set(boundaries)].sort((a, b) => a - b)) {
      if (point >= points[points.length - 1] + frame && point <= clip.end - frame) points.push(point);
    }
    points.push(clip.end);
    let pieces: ArchiveCutClip[] = points.slice(0, -1).map((start, i) => ({
      ...clone(clip),
      id: cutClipId(),
      start,
      end: points[i + 1],
      at: starts.value[index] + (start - clip.start) / (clip.speed ?? 1),
      transition: undefined,
      fadeIn: i === 0 ? clip.fadeIn : 0,
      fadeOut: i === points.length - 2 ? clip.fadeOut : 0
    }));
    if (silence)
      pieces = pieces.filter(
        (piece) =>
          !silence.some(
            (range) => (piece.start + piece.end) / 2 >= range.start && (piece.start + piece.end) / 2 <= range.end
          )
      );
    if (pieces.length && clip.transition) pieces[pieces.length - 1].transition = clone(clip.transition);
    const next = clone(clips.value);
    if (silence) {
      let at = starts.value[index];
      for (const piece of pieces) {
        piece.at = at;
        at += archiveClipDuration(piece);
      }
      const removed = archiveClipDuration(clip) - (at - starts.value[index]);
      for (const [i, entry] of next.entries())
        if (
          i !== index &&
          (entry.lane ?? 1) === (clip.lane ?? 1) &&
          starts.value[i] >= starts.value[index] + archiveClipDuration(clip) - 1e-6
        )
          entry.at = Math.max(0, starts.value[i] - removed);
    }
    next.splice(index, 1, ...pieces);
    if (!commit(next)) return;
    selected.value = pieces.map((piece) => piece.id);
  }
  function updateFrame(value: ArchiveFrame) {
    commit(clips.value, value);
  }
  function remove() {
    if (!selected.value.length) return;
    const composition = clone(studio.value);
    composition.subtitles = composition.subtitles.filter((cue) => !selected.value.includes(cue.id));
    composition.musicTracks = composition.musicTracks.filter((track) => !selected.value.includes(track.id));
    commit(
      clips.value.filter((clip) => !selected.value.includes(clip.id)),
      frameSettings.value,
      composition
    );
  }
  function resetClips() {
    if (loaded.value) {
      commit([{ id: cutClipId(), start: 0, end: sourceDuration.value, at: 0, lane: 1 }]);
      selected.value = [];
      seek(0);
    }
  }
  watch([time, selected, zoom], scheduleSave, { deep: true });
  onScopeDispose(() => {
    clearTimeout(saveTimer);
    stop();
    if (seekFrame !== undefined) cancelAnimationFrame(seekFrame);
    scope.abort();
  });
  function commitLayout(next: ArchiveCutClip[], composition: ArchiveStudio) {
    commit(next, frameSettings.value, composition);
  }
  return {
    clips,
    isGap,
    visibleIndex,
    commitLayout,
    studio,
    sourceUrls,
    sourceOf,
    fpsFor,
    durationFor,
    updateStudio,
    appendSource,
    applyAnalysis,
    onReady,
    frameSettings,
    sourceWidth,
    sourceHeight,
    duplicate,
    copySelection,
    paste,
    canPaste,
    updateClip,
    updateFrame,
    selected,
    time,
    zoom,
    snapping,
    sourceDuration,
    fps,
    loaded,
    loading,
    error,
    draftStatus,
    duration,
    starts,
    canTrim,
    undo,
    redo,
    load,
    reset,
    flush,
    seek,
    sync,
    onPlay,
    onEnded,
    togglePlay,
    begin,
    commit,
    cancelGesture,
    undoEdit,
    redoEdit,
    split,
    trim,
    remove,
    resetClips,
    stop
  };
}
