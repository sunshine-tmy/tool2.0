import type { TimelineAudioChange } from "./timeline-audio";
import { editorNumber, previewRate } from "./editor-numbers";
import { useReversePreview } from "./useReversePreview";
import { copyTimeline, pasteTimeline, type TimelineClipboard } from "./timeline-clipboard";
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
  type ArchiveSubtitle,
  type ArchiveStudioMusic,
  archiveClipDuration,
  archiveOutputFps,
  archiveNeedsSourcePreview,
  migrateArchiveStudio,
  watermarkTrackError,
  type ArchiveStudioWatermark,
  archivePreviewClip,
  type ArchiveInterpolationRuntime,
  archiveClipSourceTime,
  archiveSliceClip,
  archiveClipRangeValid,
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
  switchSource: (url: string) => void = () => {},
  musicUrl: (track: ArchiveStudio["musicTracks"][number]) => string = () => "",
  backgroundMusic: () =>
    { url: string; start: number; volume: number; loop: boolean; fadeIn: number; fadeOut: number } | undefined = () =>
    undefined,
  saveDraftEnabled: () => boolean = () => true,
  prepareEnabled: () => boolean = () => true
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
  const clipboard = ref<TimelineClipboard>();
  const interpolationRuntime = ref<ArchiveInterpolationRuntime>({
    flowReady: false,
    rifeReady: false,
    componentId: "video-interpolation",
    message: "正在检测补帧能力…"
  });
  const comparisonOriginal = ref(false);
  const legacyInterpolation = ref(false);
  const checkingInterpolation = ref(false);
  async function refreshInterpolationRuntime() {
    if (checkingInterpolation.value || typeof videoEditApi.interpolationRuntime !== "function") return;
    checkingInterpolation.value = true;
    try {
      interpolationRuntime.value = await videoEditApi.interpolationRuntime(scope.signal);
    } catch (e) {
      if (!isApiErrorCancelled(e)) error.value = formatApiError(e);
    } finally {
      checkingInterpolation.value = false;
    }
  }
  const reversePreview = useReversePreview(itemId, media, () => interpolationRuntime.value.modelVersion ?? "");
  const previewAsset = (clip: ArchiveCutClip) =>
    reversePreview.asset(clip, studio.value, archiveOutputFps(frameSettings.value));
  const reverseSources = computed(() =>
    Object.fromEntries(
      clips.value.flatMap((clip) => {
        const asset = previewAsset(clip);
        return asset
          ? [
              [
                clip.id,
                {
                  url: asset.url,
                  start: asset.start,
                  end: asset.end,
                  interpolation: asset.interpolation,
                  speed: asset.speed
                }
              ]
            ]
          : [];
      })
    )
  );
  function playback(clip: ArchiveCutClip, elapsed: number, audio = false) {
    const recipe = archivePreviewClip(clip);
    elapsed = clip.freezeSample?.time ?? elapsed;
    const source = sourceOf(clip),
      asset = comparisonOriginal.value && !audio ? undefined : previewAsset(clip);
    const position = archiveClipSourceTime(clip, elapsed, fpsFor(clip));
    return {
      url: asset?.url ?? (source ? studioUrl(source) : sourceUrl()),
      rate: asset?.interpolation ? 1 : (clip.speed ?? 1),
      position:
        asset && (clip.freezeAt === undefined || clip.freezeSample)
          ? Math.max(
              0,
              asset.interpolation
                ? (recipe.reverse ? asset.end - recipe.end : recipe.start - asset.start) / asset.speed + elapsed
                : asset.end - recipe.end + elapsed * (recipe.speed ?? 1)
            )
          : position
    };
  }
  const activeUrl = ref("");
  let wantPlay = false;
  const isPlaying = ref(false);
  const sourceOf = (clip?: ArchiveCutClip) => studio.value.sources.find((entry) => entry.id === clip?.sourceId);
  const fpsFor = (clip?: ArchiveCutClip) => sourceOf(clip)?.fps ?? fps.value;
  const durationFor = (clip?: ArchiveCutClip) => sourceOf(clip)?.duration ?? sourceDuration.value;
  const sourceUrls = computed(() =>
    Object.fromEntries(studio.value.sources.map((entry) => [entry.id, studioUrl(entry)]))
  );
  const frameSettings = ref<ArchiveFrame>(defaultArchiveFrame());
  const sourceName = ref(""),
    sourceHasAudio = ref<boolean>();
  const sourceWidth = ref(0),
    sourceHeight = ref(0);
  const duration = computed(() => archiveProjectDuration(clips.value, studio.value));
  const visibleIndex = ref(-1);
  const isGap = computed(() => visibleIndex.value < 0);
  const undo = ref<ArchiveCutDraft[]>([]),
    redo = ref<ArchiveCutDraft[]>([]);
  const starts = computed(() => archiveCutStarts(clips.value));
  function videoEligible(clip: ArchiveCutClip, index: number) {
    const edge = 0.5 / (fpsFor(clip) * (clip.speed ?? 1));
    return (
      !clip.locked &&
      selected.value.includes(clip.id) &&
      time.value > starts.value[index] + edge &&
      time.value < starts.value[index] + archiveClipDuration(clip) - edge
    );
  }
  const timedEligible = (entry: { id: string; start: number; end: number; locked?: boolean }) =>
    !entry.locked &&
    selected.value.includes(entry.id) &&
    time.value > entry.start + 0.005 &&
    time.value < entry.end - 0.005;
  const canTrim = computed(
    () =>
      clips.value.some(videoEligible) ||
      studio.value.subtitles.some(timedEligible) ||
      studio.value.musicTracks.some(timedEligible) ||
      (studio.value.watermarks ?? []).some(timedEligible)
  );
  const selectedVideos = computed(() => clips.value.filter((clip) => selected.value.includes(clip.id) && !clip.locked));
  const canVideoTools = computed(() => selectedVideos.value.length > 0);
  const freezeTarget = computed(() => {
    if (selected.value.length !== 1) return undefined;
    const index = clips.value.findIndex(
      (clip, i) =>
        selected.value[0] === clip.id &&
        !clip.locked &&
        !clip.hidden &&
        time.value >= starts.value[i] &&
        time.value < starts.value[i] + archiveClipDuration(clip)
    );
    const clip = clips.value[index];
    if (
      !clip ||
      clips.value.some((other, i) => other.lane === clip.lane && other.locked && starts.value[i] >= time.value)
    )
      return undefined;
    return { clip, index };
  });
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
    if (!loaded.value || !saveDraftEnabled()) return;
    draftStatus.value = "正在保存草稿…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flush(), 500);
  }
  async function flush() {
    clearTimeout(saveTimer);
    if (!loaded.value || !media() || !saveDraftEnabled()) return;
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
            draftStatus.value = "工程草稿已保存";
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
  let audioContext: AudioContext | undefined, master: DynamicsCompressorNode | undefined;
  function prepareAudio() {
    try {
      if (!audioContext) {
        audioContext = new AudioContext();
        master = audioContext.createDynamicsCompressor();
        master.threshold.value = -1;
        master.knee.value = 0;
        master.ratio.value = 20;
        master.attack.value = 0.003;
        master.release.value = 0.1;
        master.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
    } catch {
      /* 无 Web Audio 能力时仍保留原生播放。 */
    }
  }
  type AudioPlayer = { url: string; element: HTMLAudioElement; source?: MediaElementAudioSourceNode; gain?: GainNode };
  const audioPlayers = new Map<string, AudioPlayer>();
  function releasePlayer(player: AudioPlayer) {
    player.element.pause();
    player.source?.disconnect();
    player.gain?.disconnect();
    player.element.removeAttribute("src");
    player.element.load();
  }

  function clearAudio() {
    for (const player of audioPlayers.values()) releasePlayer(player);
    audioPlayers.clear();
  }
  function syncAudio() {
    const active = new Set<string>();
    function sound(id: string, url: string, position: number, rate: number, gain: number, loop = false) {
      if (!url || gain <= 0) return;
      active.add(id);
      let player = audioPlayers.get(id);
      if (!player || player.url !== url) {
        if (player) {
          releasePlayer(player);
        }
        const element = new Audio();
        element.crossOrigin = "anonymous";
        element.preload = "auto";
        element.src = url;
        player = { url, element };
        if (audioContext && master) {
          try {
            player.source = audioContext.createMediaElementSource(element);
            player.gain = audioContext.createGain();
            player.source.connect(player.gain);
            player.gain.connect(master);
          } catch {
            player.source?.disconnect();
            player.source = undefined;
            player.gain = undefined;
          }
        }
        audioPlayers.set(id, player);
      }
      const element = player.element;
      element.playbackRate = previewRate(rate);
      element.preservesPitch = true;
      element.volume = player.gain ? 1 : Math.max(0, Math.min(1, gain));
      if (player.gain && audioContext)
        player.gain.gain.setTargetAtTime(Math.max(0, gain), audioContext.currentTime, 0.005);
      element.loop = loop;
      if (element.readyState >= 1) {
        const target = loop && Number.isFinite(element.duration) ? position % element.duration : position;
        if (!loop && target >= element.duration) {
          element.pause();
          return;
        }
        if (!element.seeking && Math.abs(element.currentTime - target) > 0.12)
          element.currentTime = Math.max(0, target);
        if (element.paused) void element.play().catch(() => {});
      }
    }
    const fade = (position: number, length: number, fadeIn = 0, fadeOut = 0) =>
      Math.max(0, Math.min(1, fadeIn ? position / Math.min(fadeIn, length) : 1)) *
      Math.max(0, Math.min(1, fadeOut ? (length - position) / Math.min(fadeOut, length) : 1));
    for (const [i, clip] of clips.value.entries()) {
      const elapsed = time.value - starts.value[i],
        length = archiveClipDuration(clip);
      if (elapsed < 0 || elapsed >= length || clip.muted || clip.freezeAt !== undefined) continue;
      const soundSource = playback(clip, elapsed, true);
      if (archiveNeedsSourcePreview(clip) && !previewAsset(clip)) continue;
      sound(
        clip.id,
        soundSource.url,
        soundSource.position,
        soundSource.rate,
        ((((clip.volume ?? 100) / 100) * originalVolume()) / 100) * fade(elapsed, length, clip.fadeIn, clip.fadeOut)
      );
    }
    for (const track of studio.value.musicTracks) {
      const elapsed = time.value - track.start;
      if (elapsed < 0 || time.value >= track.end || track.muted) continue;
      sound(
        track.id,
        musicUrl(track),
        track.sourceStart + elapsed * (track.speed ?? 1),
        track.speed ?? 1,
        (track.volume / 100) * fade(elapsed, track.end - track.start, track.fadeIn, track.fadeOut),
        track.loop
      );
    }
    const background = backgroundMusic();
    if (background)
      sound(
        "background",
        background.url,
        background.start + time.value,
        1,
        (background.volume / 100) * fade(time.value, duration.value, background.fadeIn, background.fadeOut),
        background.loop
      );
    for (const [id, player] of audioPlayers)
      if (!active.has(id)) {
        releasePlayer(player);
        audioPlayers.delete(id);
      }
  }
  function stop() {
    wantPlay = false;
    isPlaying.value = false;
    video()?.pause();
    if (video()) video()!.muted = false;
    clearAudio();
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }
  function reset() {
    legacyInterpolation.value = false;
    stop();
    clipboard.value = undefined;
    comparisonOriginal.value = false;
    reversePreview.reset();
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
    sourceName.value = "";
    sourceHasAudio.value = undefined;
    sourceWidth.value = 0;
    sourceHeight.value = 0;
    visibleIndex.value = -1;
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
  let loadingRequest: Promise<void> | undefined;
  function load(preferSaved = false) {
    if (loading.value && loadingRequest) return loadingRequest;
    const request = loadSource(preferSaved);
    loadingRequest = request;
    void request.finally(() => {
      if (loadingRequest === request) loadingRequest = undefined;
    });
    return request;
  }
  async function loadSource(preferSaved = false) {
    if (loaded.value || loading.value || !media()) return;
    const token = generation;
    loading.value = true;
    error.value = "";
    try {
      const current = media()!;
      const result = await videoEditApi.cutSource(itemId(), current.id, scope.signal);
      if (typeof videoEditApi.interpolationRuntime === "function") {
        try {
          interpolationRuntime.value = await videoEditApi.interpolationRuntime(scope.signal);
        } catch {
          /* 能力状态失败不影响原视频编辑。 */
        }
      }
      if (token !== generation) return;
      sourceDuration.value = result.duration;
      fps.value = result.fps;
      sourceName.value = result.fileName ?? current.audioEdit?.original.fileName ?? current.fileName;
      sourceHasAudio.value = result.hasAudio;
      sourceWidth.value = result.width ?? current.audioEdit?.originalWidth ?? current.width ?? 0;
      sourceHeight.value = result.height ?? current.audioEdit?.originalHeight ?? current.height ?? 0;
      const draft = preferSaved ? undefined : result.draft;
      const inputStudio = draft?.studio ?? current.audioEdit?.studio ?? defaultArchiveStudio();
      const migrateWatermarkLane = !inputStudio.unified && Boolean(current.audioEdit?.watermark);
      studio.value = migrateArchiveStudio(
        current.audioEdit,
        inputStudio,
        archiveProjectDuration(
          draft?.clips ?? current.audioEdit?.cut ?? [{ id: "original", start: 0, end: result.duration }],
          inputStudio
        ),
        draft?.clips ?? current.audioEdit?.cut
      );
      frameSettings.value = {
        ...clone(draft?.frame ?? current.audioEdit?.frame ?? defaultArchiveFrame()),
        fit: "contain"
      };
      const saved = current.audioEdit?.cut;
      const restored = clone(draft?.clips ?? saved ?? [{ id: cutClipId(), start: 0, end: result.duration }]);
      legacyInterpolation.value = restored.some((clip) => Boolean(clip.interpolation));
      const positions = archiveCutStarts(restored);
      clips.value = restored.map(({ interpolation: _legacy, ...clip }, i) => ({
        ...clip,
        at: clip.at ?? positions[i],
        lane: (clip.lane ?? 1) + (migrateWatermarkLane ? 1 : 0)
      }));
      for (const mark of studio.value.watermarks ?? [])
        if (mark.followEnd) mark.end = Math.max(mark.start + 0.01, archiveProjectDuration(clips.value, studio.value));
      studio.value.subtitles = studio.value.subtitles.map((cue) => ({ ...cue, lane: cue.lane ?? 0 }));
      studio.value.musicTracks = studio.value.musicTracks.map((track, i) => ({ ...track, lane: track.lane ?? 2 + i }));
      const elements = [
        ...clips.value,
        ...studio.value.subtitles,
        ...studio.value.musicTracks,
        ...(studio.value.watermarks ?? [])
      ];
      const lanes = [...new Set(elements.map((entry) => entry.lane ?? 1))].sort((a, b) => a - b);
      for (const entry of elements) entry.lane = lanes.indexOf(entry.lane ?? 1);
      studio.value.lanes = Math.max(1, lanes.length);
      time.value = Math.min(draft?.playhead ?? 0, duration.value);
      selected.value = draft?.selected ?? [];
      zoom.value = draft?.zoom ?? 1;
      loaded.value = true;
      draftStatus.value = draft ? "已恢复工程草稿" : "";
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
      source: clip ? playback(clip, Math.max(0, position - starts.value[index])).position : 0
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
    const nextUrl = playback(clips.value[target.index], time.value - starts.value[target.index]).url;
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
          element.muted = wantPlay;
          element.playbackRate = previewRate(
            playback(clips.value[playingIndex], time.value - starts.value[playingIndex]).rate
          );
          element.preservesPitch = true;
          element.currentTime = pendingSeek;
          pendingSeek = undefined;
          if (
            wantPlay &&
            clips.value[playingIndex]?.freezeAt === undefined &&
            !(comparisonOriginal.value && clips.value[playingIndex]?.reverse)
          )
            void element.play().catch(() => {});
          else element.pause();
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
    if (wantPlay) syncAudio();
    const target = locate(time.value),
      element = video();
    if (target.index !== visibleIndex.value) requestVideoPosition();
    if (!element || target.index < 0 || element.getAttribute("src") !== activeUrl.value || element.readyState < 1)
      return;
    const clip = clips.value[target.index];
    const still = clip.freezeAt !== undefined,
      backwardsComparison = comparisonOriginal.value && clip.reverse;
    if (still || backwardsComparison) element.pause();
    element.muted = wantPlay;
    element.playbackRate = previewRate(playback(clip, time.value - starts.value[target.index]).rate);
    element.preservesPitch = true;
    const position = Math.max(0, time.value - starts.value[target.index]),
      length = archiveClipDuration(clip);
    const fadeIn = Math.min(clip.fadeIn ?? 0, length / 2),
      fadeOut = Math.min(clip.fadeOut ?? 0, length / 2);
    const gain = Math.min(1, fadeIn ? position / fadeIn : 1, fadeOut ? Math.max(0, length - position) / fadeOut : 1);
    element.volume = Math.max(
      0,
      Math.min(1, ((((clip.muted ? 0 : (clip.volume ?? 100)) / 100) * originalVolume()) / 100) * gain)
    );
    if (
      wantPlay &&
      !element.seeking &&
      pendingSeek === undefined &&
      Math.abs(element.currentTime - target.source) > (backwardsComparison ? 0.5 / fpsFor(clip) : 0.15)
    )
      element.currentTime = target.source;
    if (wantPlay && !still && !backwardsComparison && element.paused && !element.seeking && pendingSeek === undefined)
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
  async function togglePlay() {
    if (!loaded.value || duration.value <= 0) return;
    if (reversePreview.preparing.value) return;
    if (!wantPlay && clips.value.some((clip) => archiveNeedsSourcePreview(clip) && !previewAsset(clip))) {
      try {
        await reversePreview.prepare(clone(clips.value), clone(studio.value), archiveOutputFps(frameSettings.value));
      } catch (e) {
        if (!isApiErrorCancelled(e)) error.value = formatApiError(e);
        return;
      }
    }
    if (wantPlay) {
      sync();
      stop();
    } else {
      if (time.value >= duration.value) seek(0);
      prepareAudio();
      wantPlay = true;
      isPlaying.value = true;
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
  function beginAudio() {
    clearTimeout(saveTimer);
    gesture = snapshot();
  }
  function finishAudio() {
    commit(clips.value, frameSettings.value, studio.value);
    // 无改动的点击也要恢复开始拖动前尚未触发的草稿保存。
    scheduleSave();
  }
  /** 指针拖动期间只更新参数，结束时统一提交；不重复寻帧或生成撤回记录。 */
  function previewAudio(id: string, changes: TimelineAudioChange) {
    if (!gesture) return;
    const clean: TimelineAudioChange = {};
    for (const key of ["volume", "fadeIn", "fadeOut"] as const) {
      const value = changes[key];
      if (value !== undefined && Number.isFinite(value))
        clean[key] = Math.max(0, Math.min(key === "volume" ? 1000 : 10, editorNumber(value, key === "volume" ? 6 : 1)));
    }
    if (!Object.keys(clean).length) return;
    const clip = clips.value.find((entry) => entry.id === id);
    if (clip && !clip.locked)
      clips.value = clips.value.map((entry) => (entry.id === id ? { ...entry, ...clean } : entry));
    else {
      const music = studio.value.musicTracks.find((entry) => entry.id === id);
      if (!music || music.locked) return;
      studio.value = {
        ...studio.value,
        musicTracks: studio.value.musicTracks.map((entry) => (entry.id === id ? { ...entry, ...clean } : entry))
      };
    }
    if (wantPlay) syncAudio();
  }
  let lastPropertyKey = "",
    lastPropertyTime = 0;
  function commit(
    next: ArchiveCutClip[],
    frame = frameSettings.value,
    composition = studio.value,
    trackChange = false,
    historyKey = ""
  ): boolean {
    if (next.length > 2000 || archiveProjectDuration(next, composition) > 7200) {
      gesture = undefined;
      error.value = next.length > 2000 ? "单次粗剪最多支持 2000 个片段" : "剪辑后视频最长支持 2 小时";
      return false;
    }
    if (!trackChange) {
      function protect<T extends { id: string; locked?: boolean; lane?: number }>(original: T[], incoming: T[]): T[] {
        const result = incoming.map((entry) => {
          const old = original.find((old) => old.id === entry.id);
          return old?.locked ? { ...clone(old), lane: entry.lane } : entry;
        });
        for (const old of original)
          if (old.locked && !result.some((entry) => entry.id === old.id)) result.push(clone(old));
        return result;
      }
      next = protect(clips.value, next);
      composition = {
        ...composition,
        subtitles: protect(studio.value.subtitles, composition.subtitles),
        musicTracks: protect(studio.value.musicTracks, composition.musicTracks),
        watermarks: protect(studio.value.watermarks ?? [], composition.watermarks ?? [])
      };
    }
    next = clone(next);
    composition = clone(composition);
    for (const mark of composition.watermarks ?? [])
      if (mark.followEnd) mark.end = Math.max(mark.start + 0.01, archiveProjectDuration(next, composition));
    const entries = [
      ...(composition.watermarks ?? []).map((mark) => ({
        entry: mark,
        kind: "watermark",
        at: mark.start,
        end: mark.end,
        lane: mark.lane ?? 0
      })),
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
          !archiveClipRangeValid(
            clip,
            composition.sources.find((source) => source.id === clip.sourceId)?.duration ?? sourceDuration.value
          )
      )
    ) {
      gesture = undefined;
      error.value = "片段时间或轨道位置无效，请检查是否超出原片范围";
      return false;
    }
    if (
      !Value.Check(ArchiveStudioSchema, composition) ||
      composition.subtitles.some((cue) => cue.end <= cue.start) ||
      composition.musicTracks.some((track) => track.end <= track.start) ||
      (composition.watermarks ?? []).some((mark) => mark.end <= mark.start || watermarkTrackError(mark))
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
    if (!wantPlay) stop();
    error.value = "";
    const now = performance.now();
    if (!historyKey || historyKey !== lastPropertyKey || now - lastPropertyTime > 500) undo.value.push(before);
    lastPropertyKey = historyKey;
    lastPropertyTime = now;
    if (undo.value.length > 100) undo.value.shift();
    redo.value = [];
    clips.value = clone(next);
    frameSettings.value = clone(frame);
    studio.value = clone(composition);
    const ids = new Set(
      [...next, ...composition.subtitles, ...composition.musicTracks, ...(composition.watermarks ?? [])].map(
        (entry) => entry.id
      )
    );
    selected.value = selected.value.filter((id) => ids.has(id));
    seek(Math.min(time.value, duration.value));
    scheduleSave();
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
    lastPropertyKey = "";
    const previous = undo.value.pop();
    if (previous) {
      redo.value.push(snapshot());
      restoreSnapshot(previous);
    }
  }
  function redoEdit() {
    lastPropertyKey = "";
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
      const offset = time.value - starts.value[index];
      const left = archiveSliceClip(clone(clip), 0, offset),
        right = archiveSliceClip(clone(clip), offset);
      if (mode === "left") return [{ ...right, at: time.value }];
      if (mode === "right") return [left];
      return [
        { ...left, transition: undefined, fadeOut: 0 },
        { ...right, id: cutClipId(), at: time.value, fadeIn: 0 }
      ];
    });
    function edit<
      T extends {
        id: string;
        start: number;
        end: number;
        sourceStart?: number;
        speed?: number;
        fadeIn?: number;
        fadeOut?: number;
      }
    >(list: T[]): T[] {
      return list.flatMap((entry): T[] => {
        if (!timedEligible(entry)) return [entry];
        const right = { ...clone(entry), start: time.value };
        if (right.sourceStart !== undefined) right.sourceStart += (time.value - entry.start) * (entry.speed ?? 1);
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
    composition.watermarks = edit(composition.watermarks ?? []).map((mark) =>
      selected.value.includes(mark.id) || !studio.value.watermarks?.some((old) => old.id === mark.id)
        ? { ...mark, followEnd: false }
        : mark
    );
    const previousIds = new Set(
      [...clips.value, ...studio.value.subtitles, ...studio.value.musicTracks, ...(studio.value.watermarks ?? [])].map(
        (entry) => entry.id
      )
    );
    if (commit(next, frameSettings.value, composition)) {
      selected.value = [
        ...selected.value,
        ...[...next, ...composition.subtitles, ...composition.musicTracks, ...(composition.watermarks ?? [])]
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
    const data = copyTimeline(clips.value, studio.value, selected.value);
    if (data) clipboard.value = data;
  }
  function pasteSelection() {
    if (!loaded.value || !clipboard.value) return;
    const pasted = pasteTimeline(clipboard.value, time.value, clips.value, studio.value, cutClipId);
    if (commit(pasted.clips, frameSettings.value, pasted.studio)) {
      selected.value = pasted.selected;
      scheduleSave();
    }
  }
  function rotateVideo() {
    commit(
      clips.value.map((clip) =>
        !selectedVideos.value.includes(clip)
          ? clip
          : {
              ...clip,
              transform: {
                ...clip.transform,
                angle:
                  (((((clip.transform?.angle ?? frameSettings.value.angle ?? 0) + 90 + 180) % 360) + 360) % 360) - 180
              }
            }
      )
    );
  }
  function mirrorVideo() {
    commit(
      clips.value.map((clip) =>
        !selectedVideos.value.includes(clip)
          ? clip
          : {
              ...clip,
              transform: { ...clip.transform, flipX: !(clip.transform?.flipX ?? frameSettings.value.flipX) }
            }
      )
    );
  }
  async function reverseVideo() {
    const selected = selectedVideos.value.filter((clip) => clip.freezeAt === undefined);
    if (!selected.length || reversePreview.preparing.value) return;
    stop();
    const next = clips.value.map((clip) => (selected.includes(clip) ? { ...clip, reverse: !clip.reverse } : clip));
    try {
      await reversePreview.prepare(next, studio.value, archiveOutputFps(frameSettings.value));
      commit(next);
    } catch (e) {
      if (!isApiErrorCancelled(e)) error.value = formatApiError(e);
    }
  }
  function freezeVideo() {
    const target = freezeTarget.value;
    if (!target) return;
    const { clip, index } = target,
      at = time.value,
      offset = at - starts.value[index],
      length = archiveClipDuration(clip);
    const id = cutClipId();
    const still: ArchiveCutClip = {
      ...clone(clip),
      id,
      at,
      start: 0,
      end: 3,
      speed: 1,
      freezeAt: Math.floor((archiveClipSourceTime(clip, offset, fpsFor(clip)) + 1e-7) * fpsFor(clip)) / fpsFor(clip),
      freezeSample:
        clip.interpolation && clip.freezeAt === undefined
          ? {
              start: clip.start,
              end: clip.end,
              speed: clip.speed ?? 1,
              reverse: Boolean(clip.reverse),
              interpolation: clone(clip.interpolation),
              time:
                Math.floor((offset + 1e-7) * archiveOutputFps(frameSettings.value)) /
                archiveOutputFps(frameSettings.value),
              fps: frameSettings.value.fps ?? 30
            }
          : clip.freezeSample,
      interpolation: undefined,
      reverse: false,
      muted: true,
      fadeIn: 0,
      fadeOut: 0,
      transition: undefined
    };
    const next = clips.value.flatMap((entry, i) => {
      if (i !== index)
        return [{ ...clone(entry), at: starts.value[i] + (entry.lane === clip.lane && starts.value[i] >= at ? 3 : 0) }];
      return [
        ...(offset > 1e-7 ? [{ ...archiveSliceClip(clone(clip), 0, offset), transition: undefined, fadeOut: 0 }] : []),
        still,
        ...(length - offset > 1e-7
          ? [{ ...archiveSliceClip(clone(clip), offset), id: cutClipId(), at: at + 3, fadeIn: 0 }]
          : [])
      ];
    });
    if (commit(next)) {
      selected.value = [id];
      seek(at);
      scheduleSave();
    }
  }
  function updateClip(id: string, changes: Partial<ArchiveCutClip>, discrete = false) {
    const next = clips.value.map((clip) => (clip.id === id ? { ...clip, ...changes, id } : clip));
    if (
      next.some((clip) => !archiveClipRangeValid(clip, durationFor(clip)) || clip.end - clip.start < 0.5 / fpsFor(clip))
    ) {
      error.value = "起点须早于终点，且不能超出原片范围";
      return;
    }
    commit(
      next,
      frameSettings.value,
      studio.value,
      false,
      discrete ? "" : `clip:${id}:${Object.keys(changes).join(",")}`
    );
  }
  function updateMusic(id: string, changes: Partial<ArchiveStudioMusic>) {
    const composition = clone(studio.value);
    composition.musicTracks = composition.musicTracks.map((track) =>
      track.id === id ? { ...track, ...changes, id } : track
    );
    commit(clips.value, frameSettings.value, composition, false, `music:${id}:${Object.keys(changes).join(",")}`);
  }
  function updateStudio(value: ArchiveStudio) {
    commit(clips.value, frameSettings.value, value, false, "studio");
  }
  function updateSubtitle(id: string, changes: Partial<ArchiveSubtitle>, discrete = false) {
    const composition = clone(studio.value);
    composition.subtitles = composition.subtitles.map((cue) => (cue.id === id ? { ...cue, ...changes, id } : cue));
    commit(
      clips.value,
      frameSettings.value,
      composition,
      false,
      discrete ? "" : `subtitle:${id}:${Object.keys(changes).sort().join(",")}`
    );
  }
  function updateWatermark(id: string, changes: Partial<ArchiveStudioWatermark>, discrete = false) {
    const composition = clone(studio.value);
    composition.watermarks = (composition.watermarks ?? []).map((mark) =>
      mark.id === id ? { ...mark, ...clone(changes), id } : mark
    );
    commit(
      clips.value,
      frameSettings.value,
      composition,
      false,
      discrete ? "" : `watermark:${id}:${Object.keys(changes).join(",")}`
    );
  }
  function addWatermark(mark: ArchiveStudioWatermark) {
    const composition = clone(studio.value),
      next = clone(clips.value);
    for (const entry of [
      ...next,
      ...composition.subtitles,
      ...composition.musicTracks,
      ...(composition.watermarks ?? [])
    ])
      entry.lane = (entry.lane ?? 1) + 1;
    (composition.watermarks ??= []).push({ ...clone(mark), lane: 0 });
    if (commit(next, frameSettings.value, composition)) selected.value = [mark.id];
  }
  function registerSource(source: ArchiveStudioSource) {
    const value = clone(studio.value);
    if (
      value.sources.some(
        (entry) =>
          entry.itemId === source.itemId && entry.mediaId === source.mediaId && entry.checksum === source.checksum
      )
    )
      return;
    if (value.sources.length >= 100) {
      error.value = "最多导入 100 个视频素材";
      return;
    }
    value.sources.push(source);
    commit(clips.value, frameSettings.value, value);
  }
  function appendOriginal() {
    if (!sourceDuration.value) return;
    const id = cutClipId();
    if (
      commit([
        ...clips.value,
        { id, start: 0, end: sourceDuration.value, at: duration.value, lane: clips.value[0]?.lane ?? 1 }
      ])
    ) {
      selected.value = [id];
      seek(starts.value[clips.value.length - 1]);
    }
  }
  function insertTexts(cues: ArchiveSubtitle[]) {
    if (!cues.length) return;
    const value = clone(studio.value),
      ends: number[] = [];
    const prepared = clone(cues)
      .sort((a, b) => a.start - b.start)
      .map((cue) => {
        let lane = ends.findIndex((end) => end <= cue.start);
        if (lane < 0) lane = ends.length;
        ends[lane] = cue.end;
        return { ...cue, lane };
      });
    const next = clips.value.map((clip) => ({ ...clip, lane: (clip.lane ?? 1) + ends.length }));
    value.subtitles = value.subtitles.map((cue) => ({ ...cue, lane: (cue.lane ?? 0) + ends.length }));
    value.musicTracks = value.musicTracks.map((track) => ({ ...track, lane: (track.lane ?? 2) + ends.length }));
    value.watermarks = (value.watermarks ?? []).map((mark) => ({ ...mark, lane: (mark.lane ?? 0) + ends.length }));
    value.subtitles.push(...prepared);
    if (commit(next, frameSettings.value, value)) {
      selected.value = [prepared[0].id];
      seek(prepared[0].start);
    }
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
      {
        id,
        sourceId: known?.id ?? source.id,
        start: 0,
        end: source.duration,
        at: duration.value,
        lane: clips.value[0]?.lane ?? 1
      }
    ];
    if (commit(next, frameSettings.value, value)) {
      selected.value = [id];
      seek(starts.value[clips.value.length - 1]);
    }
  }
  function updateFrame(value: ArchiveFrame) {
    commit(clips.value, value, studio.value, false, "frame");
  }
  function remove() {
    if (!selected.value.length) return;
    const composition = clone(studio.value);
    composition.subtitles = composition.subtitles.filter((cue) => !selected.value.includes(cue.id));
    composition.musicTracks = composition.musicTracks.filter((track) => !selected.value.includes(track.id));
    composition.watermarks = (composition.watermarks ?? []).filter((mark) => !selected.value.includes(mark.id));
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
  watch(selected, () => {
    if (comparisonOriginal.value) {
      comparisonOriginal.value = false;
      seek(time.value);
    }
  });
  onScopeDispose(() => {
    if (audioContext) void audioContext.close().catch(() => {});
    clearTimeout(saveTimer);
    stop();
    if (seekFrame !== undefined) cancelAnimationFrame(seekFrame);
    scope.abort();
    reversePreview.reset();
  });
  function toggleTrack(lane: number, key: "locked" | "hidden" | "muted") {
    const next = clone(clips.value),
      composition = clone(studio.value);
    const entries = [
      ...next,
      ...composition.subtitles,
      ...composition.musicTracks,
      ...(composition.watermarks ?? [])
    ].filter((entry) => (entry.lane ?? 0) === lane);
    const value = !entries.every((entry) => entry[key]);
    for (const entry of entries) entry[key] = value;
    commit(next, frameSettings.value, composition, true);
  }
  function commitLayout(next: ArchiveCutClip[], composition: ArchiveStudio) {
    commit(next, frameSettings.value, composition);
  }
  watch(
    () =>
      loaded.value
        ? JSON.stringify(
            clips.value
              .filter(archiveNeedsSourcePreview)
              .map((clip) => [
                clip.sourceId,
                clip.start,
                clip.end,
                clip.reverse,
                clip.interpolation ? [clip.speed, clip.interpolation, frameSettings.value.fps] : null
              ])
          )
        : "",
    (_value, _previous, onCleanup) => {
      const timer = setTimeout(async () => {
        if (
          !loaded.value ||
          !prepareEnabled() ||
          !clips.value.some((clip) => archiveNeedsSourcePreview(clip) && !previewAsset(clip))
        )
          return;
        stop();
        try {
          await reversePreview.prepare(clone(clips.value), clone(studio.value), archiveOutputFps(frameSettings.value));
          if (loaded.value) seek(time.value);
        } catch (e) {
          if (!isApiErrorCancelled(e)) error.value = formatApiError(e);
        }
      }, 250);
      onCleanup(() => clearTimeout(timer));
    }
  );
  return {
    interpolationRuntime,
    legacyInterpolation,
    checkingInterpolation,
    refreshInterpolationRuntime,
    comparisonOriginal,
    processingMessage: reversePreview.message,
    interpolationNotice: reversePreview.notice,
    copySelection,
    pasteSelection,
    canPaste: computed(() => Boolean(clipboard.value)),
    rotateVideo,
    mirrorVideo,
    reverseVideo,
    freezeVideo,
    canVideoTools,
    canReverse: computed(() => selectedVideos.value.some((clip) => clip.freezeAt === undefined)),
    canFreeze: computed(() => Boolean(freezeTarget.value)),
    reversePreparing: reversePreview.preparing,
    reverseProgress: reversePreview.progress,
    reverseSources,
    freezeSources: computed(() =>
      Object.fromEntries(
        clips.value
          .filter((clip) => clip.freezeSample)
          .map((clip) => {
            const source = playback(clip, 0);
            return [clip.id, { url: source.url, time: source.position }];
          })
      )
    ),
    cancelReverse: () => reversePreview.reset(false),
    clips,
    isGap,
    visibleIndex,
    commitLayout,
    toggleTrack,
    isPlaying,
    studio,
    sourceUrls,
    sourceOf,
    fpsFor,
    durationFor,
    updateStudio,
    updateSubtitle,
    updateWatermark,
    addWatermark,
    updateMusic,
    appendSource,
    registerSource,
    appendOriginal,
    insertTexts,
    onReady,
    frameSettings,
    sourceName,
    sourceHasAudio,
    sourceWidth,
    sourceHeight,
    updateClip,
    beginAudio,
    previewAudio,
    finishAudio,
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
