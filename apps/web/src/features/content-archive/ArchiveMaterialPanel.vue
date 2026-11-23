<template>
  <section class="material-browser" aria-label="视频编辑素材库">
    <div class="browser-tabs" role="tablist" aria-label="素材类型">
      <button
        v-for="item in tabs"
        :key="item.value"
        type="button"
        role="tab"
        :aria-selected="tab === item.value"
        :class="{ active: tab === item.value }"
        @click="tab = item.value"
      >
        <component :is="item.icon" :size="19" /><span>{{ item.label }}</span>
      </button>
      <n-button
        class="reset-layout"
        quaternary
        size="tiny"
        aria-label="重置编辑器布局"
        title="重置布局"
        @click="$emit('reset')"
        ><PanelsTopLeft :size="15"
      /></n-button>
    </div>
    <n-alert v-if="error" type="error" closable @close="error = ''">{{ error }}</n-alert>
    <div class="browser-body">
      <template v-if="tab === 'sources'">
        <div class="browser-tools">
          <n-button type="primary" size="small" :disabled="disabled" @click="picker = true"
            ><template #icon><Upload :size="15" /></template>导入</n-button
          ><span>{{ videoCards.length }} 个视频素材</span>
        </div>
        <div class="video-grid">
          <article
            v-for="card in videoCards"
            :key="card.id"
            class="video-material"
            :class="{ imported: highlighted === card.id }"
          >
            <div class="video-image">
              <ArchiveVideoCover :url="card.url" :title="card.title" /><span v-if="videoAdded(card)" class="added"
                >已添加</span
              ><span class="duration">{{ clock(card.duration) }}</span
              ><button
                class="add-circle"
                type="button"
                :disabled="disabled"
                :aria-label="`添加 ${card.title} 到轨道`"
                title="添加到轨道末尾"
                @click="$emit('video', card.source)"
              >
                <Plus :size="15" />
              </button>
            </div>
            <div class="video-label" :title="card.title">{{ card.title }}</div>
          </article>
        </div>
      </template>
      <template v-else-if="tab === 'audio'">
        <div class="audio-search">
          <n-input
            v-model:value="audioKeyword"
            clearable
            placeholder="搜索音频名称、文案或备注"
            aria-label="搜索音频"
            @keyup.enter="searchAudio"
            ><template #prefix><Search :size="14" /></template></n-input
          ><n-button class="audio-search-button" type="primary" :loading="audioLoading" @click="searchAudio"
            >搜索</n-button
          >
        </div>
        <n-select
          v-model:value="audioView"
          size="small"
          :options="audioViews"
          aria-label="音频类型"
          @update:value="searchAudio"
        />
        <n-spin :show="audioLoading">
          <div class="audio-list">
            <article v-for="music in availableAudio" :key="music.id" class="audio-material">
              <button
                class="audio-art"
                type="button"
                :title="playingId === music.id ? '暂停试听' : '试听音频'"
                :aria-label="`${playingId === music.id ? '暂停' : '试听'} ${music.title}`"
                :disabled="disabled"
                @click="preview(music)"
              >
                <component :is="playingId === music.id ? Pause : Play" :size="19" />
              </button>
              <div class="audio-copy">
                <strong :title="music.title">{{ music.title }}</strong
                ><span
                  >{{ music.purpose === "music" ? "背景音乐" : music.purpose === "speech" ? "配音" : "音频" }} ·
                  {{ clock(music.duration) }}</span
                ><small v-if="studio.musicTracks.some((track) => track.libraryItemId === music.id)">已添加</small>
              </div>
              <button
                class="list-add"
                type="button"
                :disabled="disabled || studio.musicTracks.length >= 16"
                :aria-label="`添加 ${music.title} 到轨道`"
                title="添加到轨道"
                @click="addAudio(music)"
              >
                <Plus :size="17" />
              </button>
            </article>
            <n-empty v-if="!availableAudio.length && !audioLoading" description="当前条件下暂无可用音频" />
          </div>
        </n-spin>
        <n-pagination
          v-if="audioTotal > 20"
          v-model:page="audioPage"
          simple
          :page-size="20"
          :item-count="audioTotal"
          :disabled="audioLoading"
          @update:page="loadAudio"
        />
      </template>
      <ArchiveWatermarkMaterial
        v-else-if="tab === 'watermark'"
        :item-id="itemId"
        :media-id="mediaId"
        :disabled="disabled"
        @add="(asset, title) => emit('watermark', asset, title)"
      />
      <template v-else>
        <h4>添加文本</h4>
        <div class="text-grid">
          <button class="text-tile default-text" type="button" :disabled="disabled" @click="addDefault">
            <span>默认文本</span><span class="tile-plus"><Plus :size="15" /></span>
          </button>
          <button class="text-tile" type="button" :disabled="disabled" @click="scriptOpen = true">
            <Text :size="28" /><span>添加字幕稿</span>
          </button>
          <button class="text-tile" type="button" :disabled="disabled" @click="srtInput?.click()">
            <FolderOpen :size="28" /><span>导入本地字幕</span>
          </button>
        </div>
        <input ref="srtInput" hidden type="file" accept=".srt" @change="importSrt" />
      </template>
    </div>
    <ArchiveSourcePicker v-model:show="picker" :imported="studio.sources" @select="importSource" />
    <n-modal
      v-model:show="scriptOpen"
      preset="card"
      title="添加字幕稿"
      class="script-dialog"
      style="width: min(560px, calc(100vw - 32px))"
      :mask-closable="false"
    >
      <div class="script-form">
        <span>每行内容生成一个文本片段，按顺序添加。</span
        ><n-input
          v-model:value="script"
          type="textarea"
          :autosize="{ minRows: 7, maxRows: 12 }"
          placeholder="输入或粘贴字幕稿，每行一段"
          maxlength="100000"
          show-count
        /><label
          >每段时长（秒）<n-input-number
            v-model:value="textSeconds"
            :min="0.1"
            :max="60"
            :step="0.1"
            :precision="1" /></label
        ><n-alert v-if="scriptError" type="error">{{ scriptError }}</n-alert>
      </div>
      <template #footer
        ><div class="script-footer">
          <n-button @click="scriptOpen = false">取消</n-button
          ><n-button type="primary" :disabled="disabled || !script.trim()" @click="addScript">添加到轨道</n-button>
        </div></template
      >
    </n-modal>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import { NAlert, NButton, NInput, NInputNumber, NSelect, NPagination, NSpin, NEmpty, NModal } from "naive-ui";
import {
  Film,
  Music2,
  Type,
  Upload,
  Plus,
  Play,
  Pause,
  Search,
  FolderOpen,
  Text,
  PanelsTopLeft
} from "lucide-vue-next";
import type { ArchiveCutClip, ArchiveStudio, ArchiveStudioSource, ArchiveSubtitle } from "@toolbox/shared/archive";
import type { AudioLibraryItemView } from "@toolbox/shared";
import { archiveEditorAudioApi } from "../audio-library/integrations/music";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import { cutClipId } from "./useArchiveRoughCut";
import { parseStudioSrt } from "./studio-subtitles";
import ArchiveVideoCover from "./ArchiveVideoCover.vue";
import ArchiveSourcePicker from "./ArchiveSourcePicker.vue";
import ArchiveWatermarkMaterial from "./ArchiveWatermarkMaterial.vue";
import { Image as ImageIcon } from "lucide-vue-next";
import type { ArchiveWatermarkDraft } from "@toolbox/shared/archive";
const props = defineProps<{
  itemId: string;
  mediaId: string;
  initialTab?: string;
  studio: ArchiveStudio;
  clips: ArchiveCutClip[];
  time: number;
  disabled: boolean;
  playing: boolean;
  sourceName: string;
  sourceDuration: number;
  sourceUrl: string;
  sourceUrls: Record<string, string>;
}>();
const emit = defineEmits<{
  watermark: [ArchiveWatermarkDraft, string];
  import: [ArchiveStudioSource];
  video: [ArchiveStudioSource | undefined];
  studio: [ArchiveStudio];
  texts: [ArchiveSubtitle[]];
  select: [string];
  preview: [];
  reset: [];
}>();
const tabs = [
  { value: "sources", label: "素材", icon: Film },
  { value: "audio", label: "音频", icon: Music2 },
  { value: "text", label: "文本", icon: Type },
  { value: "watermark", label: "水印", icon: ImageIcon }
];
const tab = ref("sources"),
  picker = ref(false),
  error = ref(""),
  highlighted = ref("");
watch(
  () => props.initialTab,
  (value) => {
    if (value) tab.value = value;
  },
  { immediate: true }
);
type VideoCard = { id: string; title: string; duration: number; url: string; source?: ArchiveStudioSource };
const videoCards = computed<VideoCard[]>(() => [
  { id: "__primary__", title: props.sourceName || "原始视频", duration: props.sourceDuration, url: props.sourceUrl },
  ...props.studio.sources.map((source) => ({
    id: source.id,
    title: source.fileName || source.title,
    duration: source.duration,
    url:
      props.sourceUrls[source.id] ||
      resolveBackendUrl(`/api/v1/tools/media-archive/items/${source.itemId}/media/${source.mediaId}/original`),
    source
  }))
]);
const videoAdded = (card: VideoCard) =>
  props.clips.some((clip) => (card.source ? clip.sourceId === card.id : !clip.sourceId));
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
function importSource(source: ArchiveStudioSource) {
  emit("import", source);
  highlighted.value = source.id;
}
const audioKeyword = ref(""),
  audioPage = ref(1),
  audioTotal = ref(0),
  audioView = ref("all"),
  audioLoading = ref(false),
  audioItems = ref<AudioLibraryItemView[]>([]);
const audioViews = [
  { label: "全部音频", value: "all" },
  { label: "背景音乐", value: "music" },
  { label: "配音素材", value: "speech" }
];
const availableAudio = computed(() => audioItems.value.filter((item) => item.available));
let audioController: AbortController | undefined, player: HTMLAudioElement | undefined;
const playingId = ref("");
async function loadAudio() {
  audioController?.abort();
  const own = (audioController = new AbortController());
  audioLoading.value = true;
  try {
    const result = await archiveEditorAudioApi.list(
      { keyword: audioKeyword.value, page: audioPage.value, pageSize: 20, view: audioView.value },
      own.signal
    );
    if (!own.signal.aborted) {
      audioItems.value = result.items;
      audioTotal.value = result.total;
    }
  } catch (e) {
    if (!own.signal.aborted && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (audioController === own) audioLoading.value = false;
  }
}
function searchAudio() {
  audioPage.value = 1;
  void loadAudio();
}
function stopPreview() {
  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
    player = undefined;
  }
  playingId.value = "";
}
async function preview(item: AudioLibraryItemView) {
  if (playingId.value === item.id) {
    stopPreview();
    return;
  }
  stopPreview();
  emit("preview");
  const own = (player = new Audio(resolveBackendUrl(item.audioUrl)));
  playingId.value = item.id;
  own.addEventListener(
    "ended",
    () => {
      if (player === own) stopPreview();
    },
    { once: true }
  );
  own.addEventListener(
    "error",
    () => {
      if (player === own) {
        error.value = "音频试听失败，请刷新后重试";
        stopPreview();
      }
    },
    { once: true }
  );
  try {
    await own.play();
  } catch (e) {
    if (player === own) {
      error.value = e instanceof Error ? e.message : "无法试听音频";
      stopPreview();
    }
  }
}
function addAudio(item: AudioLibraryItemView) {
  if (!item.available || props.disabled || props.studio.musicTracks.length >= 16) return;
  stopPreview();
  const studio = JSON.parse(JSON.stringify(props.studio)) as ArchiveStudio,
    id = cutClipId(),
    start = Math.min(7199.9, Math.max(0, props.time));
  const lanes = [...props.clips, ...studio.subtitles, ...studio.musicTracks, ...(studio.watermarks ?? [])].map(
    (entry) => entry.lane ?? 0
  );
  studio.musicTracks.push({
    id,
    libraryItemId: item.id,
    libraryRevision: item.revision,
    title: item.title.slice(0, 500),
    start,
    end: Math.min(7200, start + item.duration),
    sourceStart: 0,
    speed: 1,
    lane: Math.max(-1, ...lanes) + 1,
    volume: 100,
    fadeIn: 0,
    fadeOut: 0,
    loop: false
  });
  emit("studio", studio);
  emit("select", id);
}
const srtInput = ref<HTMLInputElement>(),
  scriptOpen = ref(false),
  script = ref(""),
  scriptError = ref(""),
  textSeconds = ref<number | null>(3);
function addDefault() {
  emit("texts", [
    {
      id: cutClipId(),
      start: Math.min(7199.9, Math.max(0, props.time)),
      end: Math.min(7200, Math.max(0, props.time) + 3),
      text: "默认文本",
      fontSize: 36,
      color: "#ffffff",
      position: "center"
    }
  ]);
}
function addScript() {
  scriptError.value = "";
  const lines = script.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    duration = textSeconds.value ?? 3,
    start = Math.max(0, props.time);
  if (!lines.length || lines.some((line) => line.length > 2000)) {
    scriptError.value = "每段文本需为 1～2000 字";
    return;
  }
  if (lines.length + props.studio.subtitles.length > 2000 || start + lines.length * duration > 7200) {
    scriptError.value = "文本数量最多 2000 段，时间线总长不能超过 2 小时";
    return;
  }
  emit(
    "texts",
    lines.map((text, index) => ({
      id: cutClipId(),
      start: start + index * duration,
      end: start + (index + 1) * duration,
      text,
      fontSize: 36,
      color: "#ffffff",
      position: "center"
    }))
  );
  scriptOpen.value = false;
  script.value = "";
}
async function importSrt(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("SRT 文件最大 2 MiB");
    const cues = parseStudioSrt(await file.text(), cutClipId);
    if (disposed || props.disabled) return;
    if (!cues.length) throw new Error("未读取到有效字幕内容");
    if (cues.length + props.studio.subtitles.length > 2000) throw new Error("文本最多支持 2000 段");
    emit("texts", cues);
  } catch (e) {
    error.value = e instanceof Error ? e.message : formatApiError(e);
  }
}
let disposed = false;
watch(tab, () => stopPreview());
watch(
  () => props.playing,
  (playing) => {
    if (playing) stopPreview();
  }
);
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) stopPreview();
  }
);
onMounted(() => void loadAudio());
onScopeDispose(() => {
  disposed = true;
  audioController?.abort();
  stopPreview();
});
</script>
<style scoped>
.material-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  gap: 12px;
}
.browser-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 4px;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 6px;
}
.browser-tabs > button:not(.reset-layout) {
  display: grid;
  gap: 4px;
  justify-items: center;
  border: 0;
  border-radius: 6px;
  padding: 7px 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
}
.browser-tabs > button.active {
  color: var(--color-primary-600);
  background: var(--color-primary-100, #f0edff);
}
.browser-tabs .reset-layout {
  margin-left: auto;
}
.browser-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.browser-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(120px, 100%), 1fr));
  gap: 14px 10px;
  align-content: start;
}
.video-material {
  min-width: 0;
  border-radius: 8px;
}
.video-material.imported .video-image {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}
.video-image {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}
.video-label {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 6px;
}
.added,
.duration {
  position: absolute;
  top: 4px;
  color: #fff;
  background: rgb(0 0 0 / 65%);
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  pointer-events: none;
}
.added {
  left: 4px;
}
.duration {
  right: 4px;
}
.add-circle,
.list-add,
.tile-plus {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: var(--color-primary-600);
}
.add-circle {
  position: absolute;
  bottom: 5px;
  right: 5px;
  cursor: pointer;
}
.list-add {
  flex-shrink: 0;
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.45;
}
.audio-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 6px;
  flex-shrink: 0;
}
.audio-search-button {
  height: 100%;
  min-width: 60px;
  white-space: nowrap;
}
.audio-list {
  display: grid;
  gap: 9px;
}
.audio-material {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-subtle);
}
.audio-art {
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  height: 48px;
  background: var(--color-primary-100, #f0edff);
  color: var(--color-primary-600);
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}
.audio-copy {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 4px;
}
.audio-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.audio-copy span,
.audio-copy small {
  font-size: 11px;
  color: var(--color-text-secondary);
}
h4 {
  margin: 0;
  font-size: 13px;
}
.text-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
  flex-shrink: 0;
}
.text-tile {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 106px;
  padding: 12px 8px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-subtle);
  color: var(--color-text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  font-size: 12px;
}
.default-text {
  color: var(--color-text-primary);
  font-weight: 600;
}
.tile-plus {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 21px;
  height: 21px;
}
.text-tile:hover:not(:disabled) {
  border-color: var(--color-primary-600);
}
button:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}
.text-tile:focus-visible {
  outline-offset: -2px;
}
.script-dialog {
  width: min(560px, calc(100vw - 32px));
}
.script-form {
  display: grid;
  gap: 12px;
  font-size: 13px;
}
.script-form label {
  display: flex;
  align-items: center;
  gap: 12px;
}
.script-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
