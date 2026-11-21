<template>
  <section class="studio-panel" :class="{ 'external-tabs': activeTab }" aria-label="视频素材与轨道设置">
    <n-tabs v-model:value="tab" type="line" animated>
      <n-tab-pane name="sources" tab="视频素材">
        <div class="studio-form">
          <div class="studio-line">
            <n-input
              v-model:value="keyword"
              placeholder="搜索已归档作品"
              :disabled="disabled || loading"
              @keyup.enter="searchArchives"
            /><n-button :disabled="disabled || loading" @click="searchArchives">搜索</n-button>
          </div>
          <n-select
            v-model:value="archiveId"
            :options="archiveOptions"
            filterable
            placeholder="选择归档作品"
            :disabled="disabled || loading"
            @update:value="loadMedia"
          />
          <n-pagination
            v-if="archiveTotal > 20"
            v-model:page="archivePage"
            :page-size="20"
            :item-count="archiveTotal"
            :disabled="disabled || loading"
            @update:page="loadArchives"
          />
          <n-select
            v-model:value="sourceMediaId"
            :options="mediaOptions"
            placeholder="选择作品中的视频"
            :disabled="disabled || loading"
          />
          <n-button
            type="primary"
            secondary
            :loading="loading"
            :disabled="disabled || !sourceMediaId"
            @click="appendVideo"
            >添加到时间线末尾</n-button
          >
          <small>不同视频按当前主画幅等比缩放并补黑边；保存时保留拼接素材快照。</small>
          <div class="studio-sources">
            <span v-for="source in studio.sources" :key="source.id"
              >{{ source.title }} · {{ source.duration.toFixed(1) }} 秒
              <n-button
                size="tiny"
                quaternary
                :disabled="disabled || clips.some((clip) => clip.sourceId === source.id)"
                title="移除未使用的素材"
                @click="removeSource(source.id)"
                >移除</n-button
              >
            </span>
          </div>
        </div>
      </n-tab-pane>
      <n-tab-pane name="analysis" tab="智能检测">
        <div class="studio-form">
          <small>{{
            selectedClip ? "针对选中片段的原片范围进行检测；检测结果不会自动修改时间线。" : "请选择一个视频片段。"
          }}</small>
          <div class="studio-grid">
            <label
              >场景灵敏度阈值<n-input-number
                v-model:value="sceneThreshold"
                :min="0.05"
                :max="0.9"
                :step="0.05"
                :disabled="disabled || analyzing" /></label
            ><label
              >静音阈值（dB）<n-input-number
                v-model:value="silenceDb"
                :min="-80"
                :max="-10"
                :disabled="disabled || analyzing" /></label
            ><label
              >最短静音（秒）<n-input-number
                v-model:value="minSilence"
                :min="0.1"
                :max="10"
                :step="0.1"
                :disabled="disabled || analyzing"
            /></label>
          </div>
          <div class="studio-line">
            <n-button :disabled="disabled || analyzing || !selectedClip" @click="analyze('scenes')"
              >检测场景切点</n-button
            ><n-button :disabled="disabled || analyzing || !selectedClip" @click="analyze('silence')"
              >检测静音片段</n-button
            ><n-button v-if="analyzing" @click="cancelAnalysis">停止检测</n-button>
          </div>
          <template v-if="analysis"
            ><n-progress type="line" :percentage="Math.floor(analysis.progress)" />
            <p role="status">{{ analysis.message }}</p>
            <small v-if="analysisChanged">来源片段已修改，请重新检测。</small>
            <div v-if="analysis.status === 'completed'" class="studio-line">
              <n-button
                v-if="analysis.kind === 'scenes'"
                :disabled="disabled || analysisChanged || !analysis.scenes.length"
                @click="applyScenes"
                >按切点拆分</n-button
              ><n-button
                v-else
                :disabled="disabled || analysisChanged || !analysis.silence.length"
                @click="removeSilence"
                >移除检测到的静音</n-button
              >
            </div>
            <div class="analysis-results">
              <n-button
                v-for="point in analysis.scenes"
                :key="point"
                size="small"
                :disabled="analysisChanged"
                @click="seekSource(point)"
                >{{ point.toFixed(2) }} 秒</n-button
              ><n-button
                v-for="(range, index) in analysis.silence"
                :key="index"
                size="small"
                :disabled="analysisChanged"
                @click="seekSource(range.start)"
                >{{ range.start.toFixed(2) }} — {{ range.end.toFixed(2) }} 秒</n-button
              >
            </div>
          </template>
        </div>
      </n-tab-pane>
      <n-tab-pane name="subtitles" tab="字幕轨">
        <div class="studio-form">
          <div class="studio-line">
            <n-button :disabled="disabled || !duration" @click="addCue">在指针处添加字幕</n-button
            ><n-button :disabled="disabled" @click="srtInput?.click()">导入 SRT</n-button
            ><n-button :disabled="!studio.subtitles.length" @click="downloadSrt">导出 SRT</n-button
            ><input ref="srtInput" hidden type="file" accept=".srt" @change="importSrt" />
          </div>
          <n-select
            v-model:value="cueId"
            :options="cueOptions"
            filterable
            placeholder="选择字幕"
            :disabled="disabled"
          />
          <template v-if="cue"
            ><div class="studio-grid">
              <label
                >开始（秒）<n-input-number
                  v-model:value="cueDraft.start"
                  :min="0"
                  :max="7200"
                  :step="0.1"
                  :disabled="disabled" /></label
              ><label
                >结束（秒）<n-input-number
                  v-model:value="cueDraft.end"
                  :min="0"
                  :max="7200"
                  :step="0.1"
                  :disabled="disabled" /></label
              ><label
                >字号<n-input-number
                  v-model:value="cueDraft.fontSize"
                  :min="16"
                  :max="96"
                  :disabled="disabled" /></label
              ><label
                >位置<n-select v-model:value="cueDraft.position" :options="positions" :disabled="disabled"
              /></label>
            </div>
            <n-input
              v-model:value="cueDraft.text"
              type="textarea"
              maxlength="2000"
              show-count
              placeholder="输入字幕内容"
              :disabled="disabled"
            /><label>文字颜色<input v-model="cueDraft.color" type="color" :disabled="disabled" /></label>
            <div class="studio-line">
              <n-button type="primary" secondary :disabled="disabled" @click="saveCue">应用字幕</n-button
              ><n-button :disabled="disabled" @click="removeCue">删除字幕</n-button
              ><n-button @click="$emit('seek', cue.start)">定位字幕</n-button>
            </div></template
          >
          <small
            >字幕会烧录进生成的视频。可在时间线拖动字幕位置或两端调整时长；成片时长随所有元素的最晚终点更新。</small
          >
        </div>
      </n-tab-pane>
      <n-tab-pane name="music" tab="独立配乐轨">
        <div class="studio-form">
          <div class="studio-line">
            <n-input
              v-model:value="musicKeyword"
              placeholder="搜索音频素材库中的背景音乐"
              @keyup.enter="searchMusic"
              :disabled="disabled"
            /><n-button :disabled="disabled" @click="searchMusic">搜索</n-button>
          </div>
          <n-select
            v-model:value="libraryId"
            :options="libraryOptions"
            filterable
            placeholder="选择配乐素材"
            :disabled="disabled"
          />
          <n-pagination
            v-if="musicTotal > 20"
            v-model:page="musicPage"
            :page-size="20"
            :item-count="musicTotal"
            @update:page="loadMusic"
            :disabled="disabled"
          />
          <n-button :disabled="disabled || !libraryId || !duration || studio.musicTracks.length >= 16" @click="addTrack"
            >在指针处添加独立配乐轨</n-button
          >
          <n-select
            v-model:value="trackId"
            :options="trackOptions"
            placeholder="选择要编辑的配乐轨"
            :disabled="disabled"
          />
          <template v-if="track"
            ><div class="studio-grid">
              <label
                >开始（秒）<n-input-number
                  v-model:value="trackDraft.start"
                  :min="0"
                  :max="7200"
                  :step="0.1"
                  :disabled="disabled" /></label
              ><label
                >结束（秒）<n-input-number
                  v-model:value="trackDraft.end"
                  :min="0"
                  :max="7200"
                  :step="0.1"
                  :disabled="disabled" /></label
              ><label
                >音乐起点（秒）<n-input-number
                  v-model:value="trackDraft.sourceStart"
                  :min="0"
                  :max="86400"
                  :step="0.1"
                  :disabled="disabled" /></label
              ><label
                >音量（%）<n-input-number
                  v-model:value="trackDraft.volume"
                  :min="0"
                  :max="100"
                  :disabled="disabled" /></label
              ><label
                >淡入（秒）<n-input-number
                  v-model:value="trackDraft.fadeIn"
                  :min="0"
                  :max="5"
                  :step="0.1"
                  :disabled="disabled" /></label
              ><label
                >淡出（秒）<n-input-number
                  v-model:value="trackDraft.fadeOut"
                  :min="0"
                  :max="5"
                  :step="0.1"
                  :disabled="disabled"
              /></label>
            </div>
            <n-checkbox v-model:checked="trackDraft.loop" :disabled="disabled">音乐不足时循环</n-checkbox>
            <div class="studio-line">
              <n-button type="primary" secondary :disabled="disabled" @click="saveTrack">应用配乐轨</n-button
              ><n-button :disabled="disabled" @click="removeTrack">删除配乐轨</n-button
              ><n-button @click="$emit('seek', track.start)">定位配乐</n-button>
            </div></template
          >
          <small
            >独立配乐轨与原声、原有配乐共同混音。拖动轨道或调整两端可修改位置和时长；完整混音效果请生成预览。</small
          >
        </div>
      </n-tab-pane>
    </n-tabs>
    <n-alert v-if="error" type="error" closable @close="error = ''">{{ error }}</n-alert>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, onScopeDispose, reactive, ref, watch } from "vue";
import {
  NAlert,
  NButton,
  NCheckbox,
  NInput,
  NInputNumber,
  NPagination,
  NProgress,
  NSelect,
  NTabPane,
  NTabs
} from "naive-ui";
import {
  archiveCutStarts,
  type ArchiveStudio,
  type ArchiveStudioSource,
  type ArchiveCutClip,
  type ArchiveAnalysisJob,
  type ArchiveSubtitle,
  type ArchiveStudioMusic,
  type ContentArchiveListItem,
  type ContentArchiveMedia
} from "@toolbox/shared/archive";
import type { AudioLibraryItemView } from "@toolbox/shared";
import { contentArchiveApi } from "./content-api";
import { videoEditApi } from "./video-edit-api";
import { cutClipId } from "./useArchiveRoughCut";
import { archiveMusicLibraryApi as musicApi } from "../audio-library/integrations/music";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import { parseStudioSrt, exportStudioSrt } from "./studio-subtitles";
const props = defineProps<{
  activeTab?: string;
  itemId: string;
  mediaId: string;
  clips: ArchiveCutClip[];
  selected: string[];
  studio: ArchiveStudio;
  time: number;
  duration: number;
  disabled: boolean;
}>();
const emit = defineEmits<{
  studio: [ArchiveStudio];
  source: [ArchiveStudioSource];
  seek: [number];
  analysis: [id: string, boundaries: number[], silence?: Array<{ start: number; end: number }>];
}>();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const tab = ref("sources"),
  error = ref(""),
  loading = ref(false),
  keyword = ref(""),
  archivePage = ref(1),
  archiveTotal = ref(0),
  archives = ref<ContentArchiveListItem[]>([]),
  archiveId = ref<string | null>(null),
  sourceMediaId = ref<string | null>(null),
  sourceMedia = ref<ContentArchiveMedia[]>([]);
watch(
  () => props.activeTab,
  (value) => {
    if (value) tab.value = value;
  },
  { immediate: true }
);

const scope = new AbortController();
let archiveRevision = 0,
  mediaRevision = 0,
  pollTimer: ReturnType<typeof setTimeout> | undefined;
const archiveOptions = computed(() => archives.value.map((item) => ({ label: item.title || item.id, value: item.id })));
const mediaOptions = computed(() =>
  sourceMedia.value.map((media, i) => ({
    label: `视频 ${i + 1} · ${((media.durationMs ?? 0) / 1000).toFixed(1)} 秒`,
    value: media.id
  }))
);
function report(e: unknown) {
  if (!scope.signal.aborted && !isApiErrorCancelled(e))
    error.value = e instanceof Error ? e.message : formatApiError(e);
}
async function loadArchives() {
  const revision = ++archiveRevision;
  try {
    const result = await contentArchiveApi.list(
      { keyword: keyword.value, page: archivePage.value, pageSize: 20 },
      scope.signal
    );
    if (revision === archiveRevision) {
      archives.value = result.items;
      archiveTotal.value = result.total;
    }
  } catch (e) {
    report(e);
  }
}
function searchArchives() {
  archivePage.value = 1;
  void loadArchives();
}
async function loadMedia() {
  const revision = ++mediaRevision;
  sourceMedia.value = [];
  sourceMediaId.value = null;
  if (!archiveId.value) return;
  try {
    const item = await contentArchiveApi.detail(archiveId.value, scope.signal);
    if (revision === mediaRevision) {
      sourceMedia.value = item.media.filter((media) => ["video", "live-photo"].includes(media.kind));
      sourceMediaId.value = sourceMedia.value[0]?.id ?? null;
    }
  } catch (e) {
    report(e);
  }
}
async function appendVideo() {
  if (!archiveId.value || !sourceMediaId.value || props.disabled || loading.value) return;
  loading.value = true;
  const itemId = archiveId.value,
    mediaId = sourceMediaId.value;
  try {
    const info = await videoEditApi.cutSource(itemId, mediaId, scope.signal);
    if (scope.signal.aborted || props.disabled) return;
    if (props.studio.sources.length >= 100) throw new Error("最多添加 100 个拼接素材");
    emit("source", {
      id: cutClipId(),
      itemId,
      mediaId,
      checksum: info.checksum,
      title: (archives.value.find((item) => item.id === itemId)?.title ?? "归档视频").slice(0, 500),
      duration: info.duration,
      width: info.width ?? 1280,
      height: info.height ?? 720,
      fps: info.fps
    });
  } catch (e) {
    report(e);
  } finally {
    loading.value = false;
  }
}
function removeSource(id: string) {
  if (props.clips.some((clip) => clip.sourceId === id)) return;
  const value = clone(props.studio);
  value.sources = value.sources.filter((source) => source.id !== id);
  emit("studio", value);
}
const selectedClip = computed(() =>
  props.selected.length === 1 ? props.clips.find((clip) => clip.id === props.selected[0]) : undefined
);
const sceneThreshold = ref<number | null>(0.3),
  silenceDb = ref<number | null>(-35),
  minSilence = ref<number | null>(0.5),
  analysis = ref<ArchiveAnalysisJob>(),
  analysisClip = ref<ArchiveCutClip>();
const analyzing = computed(() => analysis.value && ["pending", "running"].includes(analysis.value.status));
const analysisChanged = computed(
  () =>
    !analysisClip.value ||
    JSON.stringify(props.clips.find((clip) => clip.id === analysisClip.value!.id)) !==
      JSON.stringify(analysisClip.value)
);
async function analyze(kind: "scenes" | "silence") {
  if (!selectedClip.value || analyzing.value || props.disabled) return;
  analysisClip.value = clone(selectedClip.value);
  try {
    const clip = analysisClip.value;
    analysis.value = await videoEditApi.analyze(
      props.itemId,
      props.mediaId,
      {
        kind,
        start: clip.start,
        end: clip.end,
        sceneThreshold: sceneThreshold.value ?? 0.3,
        silenceDb: silenceDb.value ?? -35,
        minSilence: minSilence.value ?? 0.5,
        source: props.studio.sources.find((source) => source.id === clip.sourceId)
      },
      scope.signal
    );
    schedulePoll();
  } catch (e) {
    report(e);
  }
}
function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(() => void poll(), 750);
}
async function poll() {
  if (!analysis.value || scope.signal.aborted) return;
  try {
    analysis.value = await videoEditApi.analysis(analysis.value.id, scope.signal);
    if (analyzing.value) schedulePoll();
  } catch (e) {
    report(e);
  }
}
async function cancelAnalysis() {
  if (analysis.value) {
    try {
      analysis.value = await videoEditApi.cancelAnalysis(analysis.value.id, scope.signal);
    } catch (e) {
      report(e);
    }
  }
}
function applyScenes() {
  if (!analysisChanged.value && analysis.value && analysisClip.value)
    emit("analysis", analysisClip.value.id, analysis.value.scenes);
}
function removeSilence() {
  if (!analysisChanged.value && analysis.value && analysisClip.value)
    emit(
      "analysis",
      analysisClip.value.id,
      analysis.value.silence.flatMap((range) => [range.start, range.end]),
      analysis.value.silence
    );
}
function seekSource(value: number) {
  const index = props.clips.findIndex((clip) => clip.id === analysisClip.value?.id);
  if (index >= 0)
    emit(
      "seek",
      archiveCutStarts(props.clips)[index] + (value - props.clips[index].start) / (props.clips[index].speed ?? 1)
    );
}
const cueId = ref<string | null>(null),
  srtInput = ref<HTMLInputElement>();
const cue = computed(() => props.studio.subtitles.find((entry) => entry.id === cueId.value));
const cueDraft = reactive<ArchiveSubtitle>({
  id: "",
  start: 0,
  end: 3,
  text: "",
  fontSize: 36,
  color: "#ffffff",
  position: "bottom"
});
watch(
  cue,
  (value) => {
    if (value) Object.assign(cueDraft, clone(value));
  },
  { deep: true }
);
const cueOptions = computed(() =>
  props.studio.subtitles.map((entry) => ({
    label: `${entry.start.toFixed(2)} — ${entry.end.toFixed(2)} · ${entry.text.slice(0, 40)}`,
    value: entry.id
  }))
);
const positions = [
  { label: "上方", value: "top" },
  { label: "居中", value: "center" },
  { label: "下方", value: "bottom" }
];
function addCue() {
  if (!props.duration) return;
  const value = clone(props.studio),
    id = cutClipId(),
    start = Math.min(props.time, Math.max(0, props.duration - 0.1));
  value.subtitles.push({
    id,
    start,
    end: Math.min(props.duration, start + 3),
    text: "请输入字幕",
    lane: 0,
    fontSize: 36,
    color: "#ffffff",
    position: "bottom"
  });
  emit("studio", value);
  cueId.value = id;
}
function saveCue() {
  if (!cueDraft.text.trim() || cueDraft.end <= cueDraft.start) {
    error.value = "请输入字幕，并确保终点晚于起点";
    return;
  }
  cueDraft.start = Number(cueDraft.start ?? 0);
  cueDraft.end = Number(cueDraft.end ?? 0);
  cueDraft.fontSize = Number(cueDraft.fontSize ?? 36);
  const value = clone(props.studio);
  value.subtitles = value.subtitles.map((entry) => (entry.id === cueId.value ? clone(cueDraft) : entry));
  emit("studio", value);
}
function removeCue() {
  const value = clone(props.studio);
  value.subtitles = value.subtitles.filter((entry) => entry.id !== cueId.value);
  emit("studio", value);
  cueId.value = null;
}
async function importSrt(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("SRT 文件最大 2 MiB");
    const cues = parseStudioSrt(await file.text(), cutClipId);
    if (scope.signal.aborted || props.disabled) return;
    const value = clone(props.studio);
    value.subtitles = [...value.subtitles, ...cues];
    if (value.subtitles.length > 2000) throw new Error("字幕最多支持 2000 条");
    emit("studio", value);
    cueId.value = cues[0]?.id ?? null;
  } catch (e) {
    report(e);
  }
}
function downloadSrt() {
  const url = URL.createObjectURL(
    new Blob([exportStudioSrt(props.studio.subtitles)], { type: "text/plain;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "字幕.srt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const musicKeyword = ref(""),
  musicPage = ref(1),
  musicTotal = ref(0),
  library = ref<AudioLibraryItemView[]>([]),
  libraryId = ref<string | null>(null),
  trackId = ref<string | null>(null);
let musicRevision = 0;
const libraryOptions = computed(() =>
  library.value.filter((entry) => entry.available).map((entry) => ({ label: entry.title, value: entry.id }))
);
const trackOptions = computed(() =>
  props.studio.musicTracks.map((entry, i) => ({ label: `配乐 ${i + 1} · ${entry.title}`, value: entry.id }))
);
const track = computed(() => props.studio.musicTracks.find((entry) => entry.id === trackId.value));
const trackDraft = reactive<ArchiveStudioMusic>({
  id: "",
  libraryItemId: "",
  libraryRevision: 1,
  title: "",
  start: 0,
  end: 3,
  sourceStart: 0,
  volume: 20,
  loop: false,
  fadeIn: 0.5,
  fadeOut: 0.5
});
watch(
  track,
  (value) => {
    if (value) Object.assign(trackDraft, clone(value));
  },
  { deep: true }
);
async function loadMusic() {
  const revision = ++musicRevision;
  try {
    const result = await musicApi.list(
      { view: "music", keyword: musicKeyword.value, page: musicPage.value },
      scope.signal
    );
    if (revision === musicRevision) {
      library.value = result.items;
      musicTotal.value = result.total;
    }
  } catch (e) {
    report(e);
  }
}
function searchMusic() {
  musicPage.value = 1;
  void loadMusic();
}
function addTrack() {
  const music = library.value.find((entry) => entry.id === libraryId.value);
  if (!music || !props.duration) return;
  const value = clone(props.studio),
    id = cutClipId(),
    start = Math.min(props.time, Math.max(0, props.duration - 0.1));
  value.musicTracks.push({
    id,
    libraryItemId: music.id,
    libraryRevision: music.revision,
    title: music.title.slice(0, 500),
    start,
    end: Math.min(props.duration, start + music.duration),
    sourceStart: 0,
    lane: Math.min(1999, 2 + value.musicTracks.length),
    volume: 20,
    loop: false,
    fadeIn: 0.5,
    fadeOut: 0.5
  });
  emit("studio", value);
  trackId.value = id;
}
function saveTrack() {
  if (trackDraft.end <= trackDraft.start) {
    error.value = "配乐终点须晚于起点";
    return;
  }
  trackDraft.start = Number(trackDraft.start ?? 0);
  trackDraft.end = Number(trackDraft.end ?? 0);
  trackDraft.sourceStart = Number(trackDraft.sourceStart ?? 0);
  trackDraft.volume = Number(trackDraft.volume ?? 20);
  trackDraft.fadeIn = Number(trackDraft.fadeIn ?? 0);
  trackDraft.fadeOut = Number(trackDraft.fadeOut ?? 0);
  const value = clone(props.studio);
  value.musicTracks = value.musicTracks.map((entry) => (entry.id === trackId.value ? clone(trackDraft) : entry));
  emit("studio", value);
}
function removeTrack() {
  const value = clone(props.studio);
  value.musicTracks = value.musicTracks.filter((entry) => entry.id !== trackId.value);
  emit("studio", value);
  trackId.value = null;
}
watch(
  () => props.selected,
  (ids) => {
    if (ids.length !== 1) return;
    if (props.studio.subtitles.some((cue) => cue.id === ids[0])) {
      cueId.value = ids[0];
      if (!props.activeTab || props.activeTab === "subtitles") tab.value = "subtitles";
    } else if (props.studio.musicTracks.some((track) => track.id === ids[0])) {
      trackId.value = ids[0];
      if (!props.activeTab || props.activeTab === "music") tab.value = "music";
    }
  },
  { deep: true, immediate: true }
);
onMounted(() => {
  void loadArchives();
  void loadMusic();
});
onScopeDispose(() => {
  clearTimeout(pollTimer);
  if (analyzing.value && analysis.value) void videoEditApi.cancelAnalysis(analysis.value.id).catch(() => {});
  scope.abort();
});
</script>
<style scoped>
.external-tabs :deep(.n-tabs-nav) {
  display: none;
}
.studio-panel {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  padding: 14px;
  margin-top: 12px;
}
.studio-form {
  display: grid;
  gap: 12px;
  padding: 8px 0;
}
.studio-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.studio-line :deep(.n-input) {
  flex: 1;
  min-width: 180px;
}
.studio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.studio-form label {
  display: grid;
  gap: 6px;
}
.studio-form small {
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.studio-sources,
.analysis-results {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 180px;
  overflow: auto;
}
.studio-sources span {
  border-radius: 6px;
  background: var(--color-surface-subtle);
  padding: 6px 10px;
  font-size: 12px;
}
</style>
