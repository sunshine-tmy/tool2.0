<template>
  <component
    :is="embedded ? 'section' : NModal"
    v-bind="embedded ? {} : { show, maskClosable: false }"
    @update:show="close"
  >
    <n-card
      :title="isImage ? '图集生成配乐视频' : '编辑视频：配乐与水印'"
      class="audio-editor"
      :class="{ 'is-embedded': embedded }"
      closable
      @close="close"
    >
      <p class="editor-hint">始终从原片生成，可反复换音乐。保存后详情与下载使用最新成品，原片保留。</p>
      <n-alert v-if="error || watermarkError" type="error"
        >{{ error || watermarkError
        }}<n-button v-if="activeJob" size="small" @click="schedulePoll(generation)">重试状态</n-button></n-alert
      >
      <n-alert v-if="!ready && initialized" type="warning"
        >需要已安装的 FFmpeg 共享媒体运行时；请在能力管理中检查后重新打开。</n-alert
      >
      <div class="editor-layout">
        <section class="editor-preview">
          <ArchiveWatermarkPreview
            :video="video"
            :active="
              panel === 'watermark' &&
              !previewIsDraft &&
              !viewingOriginal &&
              previewUrl === watermarkBaseUrl &&
              Boolean(!current?.audioEdit?.watermark || basePreviewUrl)
            "
            :asset="watermarkAsset"
            :settings="watermarkSettings"
            :disabled="busy"
            @move="moveWatermark"
            @time="playhead = $event"
            @duration="recordDuration"
          >
            <video
              v-if="!isImage || previewIsDraft"
              ref="video"
              :key="previewUrl"
              :src="previewUrl"
              controls
              playsinline
              preload="metadata"
              @play="musicRange?.stop()"
              @error="previewError"
            />
            <img v-else class="slideshow-image" :src="previewUrl" alt="图集原图预览" />
          </ArchiveWatermarkPreview>
          <video
            v-if="current?.audioEdit && !isImage"
            :key="`${originalUrl}/${current.checksum}`"
            data-original-duration
            :src="originalUrl"
            preload="metadata"
            hidden
            style="display: none"
            @loadedmetadata="recordOriginalDuration"
          />
          <div v-if="isImage" class="editor-fades">
            <label
              >每张停留（秒）<n-input-number
                v-model:value="secondsPerImage"
                :min="0.5"
                :max="30"
                :disabled="busy" /></label
            ><label
              >视频画幅<n-select
                v-model:value="aspect"
                :disabled="busy"
                :options="[
                  { label: '竖版 720 × 1280', value: 'portrait' },
                  { label: '横版 1280 × 720', value: 'landscape' },
                  { label: '方形 1080 × 1080', value: 'square' }
                ]"
            /></label>
          </div>
          <p v-if="isImage" class="editor-hint">按原图顺序生成附加视频，原图不会被替换；生成后可在视频中继续换配乐。</p>
          <p>
            {{
              previewIsDraft
                ? panel === "watermark"
                  ? "效果预览片段（尚未保存）"
                  : "完整试听（尚未保存）"
                : isImage
                  ? "原图预览"
                  : viewingOriginal
                    ? "原始视频"
                    : panel === "watermark" && previewUrl === watermarkBaseUrl
                      ? "当前已保存配乐 · 水印实时预览"
                      : "当前已保存视频"
            }}
          </p>
          <div class="editor-actions">
            <n-button @click="viewOriginal">{{ isImage ? "查看原图" : "查看原始视频" }}</n-button>
            <n-button v-if="viewingOriginal && !isImage" @click="viewCurrent">查看当前已保存视频</n-button>
            <n-input-number
              v-if="panel === 'watermark'"
              v-model:value="previewStart"
              :min="0"
              :max="Math.max(0, (current?.durationMs || 0) / 1000 - 0.1)"
              :disabled="busy"
              aria-label="试听起点秒数"
            />
            <n-button :disabled="busy || !ready || Boolean(watermarkValidation)" @click="submit('preview')">{{
              panel === "watermark" ? "生成 15 秒水印效果" : "试听完整视频效果"
            }}</n-button>
          </div>
          <p v-if="basePreviewJob && activeJob" class="editor-hint">
            正在准备保留当前配乐的无水印编辑画面，避免重复叠加旧水印…
          </p>
          <n-button v-if="basePreviewFailed && !busy" @click="submit('preview', true)">重试水印编辑画面</n-button>
          <template v-if="job">
            <n-progress
              type="line"
              :percentage="Math.floor(job.progress)"
              :status="job.status === 'failed' ? 'error' : job.status === 'completed' ? 'success' : 'default'"
            />
            <p role="status">{{ job.message }}</p>
            <n-button v-if="activeJob" :disabled="job.stage === 'saving'" @click="cancel">停止当前任务</n-button>
          </template>
        </section>
        <section class="editor-controls">
          <div v-if="!isImage" class="editor-actions">
            <n-button :type="panel === 'audio' ? 'primary' : 'default'" @click="panel = 'audio'">配乐设置</n-button>
            <n-button :type="panel === 'watermark' ? 'primary' : 'default'" @click="panel = 'watermark'"
              >水印设置</n-button
            >
          </div>
          <ArchiveWatermarkControls
            v-if="panel === 'watermark' && !isImage"
            v-model:settings="watermarkSettings"
            v-model:selected-point="selectedPoint"
            v-model:selected-frame="selectedFrame"
            :asset="watermarkAsset"
            :disabled="busy"
            :duration="videoDuration"
            :time="playhead"
            @upload="uploadWatermark"
            @select-library="selectLibraryWatermark"
            @remove="removeWatermark"
            @move="moveWatermark"
            @seek="seekWatermark"
          />
          <template v-else>
            <label v-if="!isImage"
              >视频原声音量 {{ settings.originalVolume }}%<n-slider
                v-model:value="settings.originalVolume"
                :min="0"
                :max="100"
                :disabled="busy"
                aria-label="视频原声音量"
            /></label>
            <n-button
              v-if="!isImage"
              size="small"
              :disabled="busy"
              @click="settings.originalVolume = settings.originalVolume ? 0 : 100"
              >{{ settings.originalVolume ? "原声静音" : "恢复原声 100%" }}</n-button
            >
            <label
              >背景音乐音量 {{ settings.musicVolume }}%<n-slider
                v-model:value="settings.musicVolume"
                :min="0"
                :max="100"
                :disabled="busy"
                aria-label="背景音乐音量"
            /></label>
            <n-button
              size="small"
              :disabled="busy || !musicId"
              @click="settings.musicVolume = settings.musicVolume ? 0 : 20"
              >{{ settings.musicVolume ? "配乐静音" : "恢复配乐 20%" }}</n-button
            >
            <p v-if="!isImage" class="editor-hint">原声音量调到 0 即静音，原声中的讲话与已有音乐会一起调节。</p>
            <div class="editor-actions">
              <span class="editor-hint">仅查询音频素材库中的「背景音乐」</span>
              <n-button :disabled="busy" @click="fileInput?.click()">上传音乐</n-button>
              <router-link
                v-if="embedded"
                :to="{
                  path: '/tools/audio-convert',
                  query: { archiveId: item.id, mediaId, returnTo: conversionReturnTo }
                }"
                ><n-button :disabled="busy">OGG / MGG / FLAC 转 MP3</n-button></router-link
              >
              <input ref="fileInput" hidden type="file" accept=".mp3,.wav,.m4a,.flac" @change="uploadMusic" />
            </div>
            <div class="editor-actions">
              <n-input
                v-model:value="keyword"
                placeholder="搜索音乐标题、备注"
                :disabled="busy"
                @keyup.enter="searchMusic"
              /><n-button :disabled="busy" @click="searchMusic">搜索</n-button>
            </div>
            <n-select
              :value="musicId"
              :options="musicOptions"
              clearable
              :disabled="busy"
              placeholder="不添加背景音乐"
              aria-label="选择背景音乐"
              @update:value="chooseMusic"
            />
            <n-pagination
              v-if="musicTotal > 20"
              v-model:page="musicPage"
              class="pagination-with-total"
              :page-size="20"
              :item-count="musicTotal"
              :disabled="busy"
              @update:page="loadMusic"
              ><template #prefix>共 {{ musicTotal }} 条</template></n-pagination
            >
            <ArchiveMusicRange
              v-if="musicUrl"
              ref="musicRange"
              :key="musicUrl"
              v-model:start="settings.musicStartSeconds"
              :url="musicUrl"
              :title="
                musicId === '__original__'
                  ? originalMusic?.title || '原作品配乐'
                  : (chosenMusic?.title ?? current?.audioEdit?.music?.title ?? '当前配乐')
              "
              :music-duration="musicId === '__original__' ? undefined : chosenMusic?.duration"
              :video-duration="editDuration"
              :disabled="busy"
              :loop="settings.loop"
              :volume="settings.musicVolume"
              @play="video?.pause()"
            />
            <n-checkbox v-model:checked="settings.loop" :disabled="busy || !musicId"
              >音乐不足时循环；超出视频部分自动截断</n-checkbox
            >
            <div class="editor-fades">
              <label
                >淡入（秒）<n-input-number
                  v-model:value="settings.fadeInSeconds"
                  :min="0"
                  :max="5"
                  :disabled="busy || !musicId" /></label
              ><label
                >淡出（秒）<n-input-number
                  v-model:value="settings.fadeOutSeconds"
                  :min="0"
                  :max="5"
                  :disabled="busy || !musicId"
              /></label>
            </div>
            <p v-if="uploading" role="status">正在上传音乐…</p>
          </template>
          <p v-if="watermarkUploading" role="status">正在上传水印…</p>
        </section>
      </div>
      <template #footer
        ><div class="editor-actions editor-footer">
          <n-button :disabled="busy || !current?.audioEdit" @click="restore">恢复原始视频</n-button>
          <n-button @click="close">关闭窗口</n-button>
          <n-button
            type="primary"
            :loading="submitting"
            :disabled="busy || !ready || !initialized || Boolean(watermarkValidation)"
            @click="submit('save')"
            >{{ isImage ? "生成视频并归档" : "保存为最新版本" }}</n-button
          >
        </div>
        <small
          >长期保留原片、最新成品及当前配乐和水印；旧成品在成功保存且播放或下载结束后清理，不保留无限版本。添加水印需要重新编码，耗时及文件大小可能增加。</small
        ></template
      >
    </n-card>
  </component>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch, toRaw } from "vue";
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NProgress,
  NSelect,
  NSlider
} from "naive-ui";
import {
  defaultArchiveAudioSettings,
  watermarkTimingError,
  type ArchiveVideoEditInput,
  type ArchiveVideoEditJob,
  type AudioLibraryItemView,
  type ContentArchiveItem,
  type ContentArchiveMedia
} from "@toolbox/shared";
import { videoEditApi } from "./video-edit-api";
import { contentArchiveApi } from "./content-api";
import { archiveMusicLibraryApi as audioLibraryApi } from "../audio-library/integrations/music";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import ArchiveWatermarkControls from "./ArchiveWatermarkControls.vue";
import ArchiveWatermarkPreview from "./ArchiveWatermarkPreview.vue";
import ArchiveMusicRange from "./ArchiveMusicRange.vue";
import { useArchiveWatermark } from "./useArchiveWatermark";
const props = defineProps<{
  show: boolean;
  item: ContentArchiveItem;
  mediaId: string;
  embedded?: boolean;
  initialPanel?: "audio" | "watermark";
  initialMusicId?: string;
  conversionReturnTo?: string;
}>();
const emit = defineEmits<{ "update:show": [value: boolean]; saved: [item: ContentArchiveItem] }>();
const confirm = useConfirmDialog();
const current = ref<ContentArchiveMedia>();
const panel = ref(props.initialPanel ?? "audio"),
  playhead = ref(0),
  videoDuration = ref(0),
  originalDuration = ref(0);
const {
  settings: watermarkSettings,
  asset: watermarkAsset,
  input: watermarkInput,
  uploading: watermarkUploading,
  error: watermarkError,
  selectedPoint,
  selectedFrame,
  load: loadWatermark,
  upload: uploadWatermark,
  selectLibrary: selectLibraryWatermark,
  move: moveWatermark,
  remove: removeWatermark
} = useArchiveWatermark(
  () => props.item.id,
  current,
  () => scope.signal
);
const watermarkValidation = computed(() =>
  watermarkInput.value ? watermarkTimingError(watermarkSettings.value, videoDuration.value) : undefined
);
const isImage = computed(() => current.value?.kind === "image");
const secondsPerImage = ref(3),
  aspect = ref<"portrait" | "landscape" | "square">("portrait");
const editDuration = computed(() =>
  isImage.value
    ? props.item.media.filter((entry) => entry.kind === "image" && !entry.frameSourceMediaId).length *
      secondsPerImage.value
    : videoDuration.value
);
const settings = reactive(defaultArchiveAudioSettings());
const originalMusic = computed(() => props.item.media.find((media) => media.kind === "audio"));
const musicId = ref<string | null>(null),
  chosenMusic = ref<AudioLibraryItemView>(),
  music = ref<AudioLibraryItemView[]>([]);
const musicPage = ref(1),
  musicTotal = ref(0),
  keyword = ref("");
const job = ref<ArchiveVideoEditJob>(),
  error = ref(""),
  ready = ref(false),
  initialized = ref(false),
  submitting = ref(false),
  syncingResult = ref(false),
  uploading = ref(false);
const previewUrl = ref(""),
  previewIsDraft = ref(false),
  previewStart = ref(0),
  video = ref<HTMLVideoElement>(),
  fileInput = ref<HTMLInputElement>();
const musicRange = ref<InstanceType<typeof ArchiveMusicRange>>();
const viewingOriginal = ref(false),
  basePreviewUrl = ref(""),
  basePreviewJob = ref<string>(),
  basePreviewFailed = ref(false);
const activeJob = computed(() => Boolean(job.value && ["pending", "running"].includes(job.value.status)));
const initialRecipe = ref("");
const recipe = computed(() =>
  JSON.stringify([
    settings,
    musicId.value,
    isImage.value ? [secondsPerImage.value, aspect.value] : null,
    watermarkInput.value
  ])
);
const busy = computed(
  () =>
    submitting.value ||
    syncingResult.value ||
    uploading.value ||
    watermarkUploading.value ||
    activeJob.value ||
    !initialized.value
);
const originalUrl = computed(() =>
  resolveBackendUrl(
    `/api/v1/tools/media-archive/items/${props.item.id}/media/${current.value?.id ?? props.mediaId}/original`
  )
);
const savedUrl = computed(() => (current.value ? resolveBackendUrl(current.value.previewUrl) : ""));
const watermarkBaseUrl = computed(() =>
  current.value?.audioEdit?.watermark ? basePreviewUrl.value || savedUrl.value : savedUrl.value
);
const musicOptions = computed(() => {
  const items = [...music.value];
  if (chosenMusic.value && !items.some((item) => item.id === chosenMusic.value!.id)) items.unshift(chosenMusic.value);
  return [
    ...(originalMusic.value
      ? [{ label: `${originalMusic.value.title || "原作品配乐"}（随作品归档）`, value: "__original__" }]
      : []),
    ...(current.value?.audioEdit?.music
      ? [{ label: `${current.value.audioEdit.music.title}（当前配乐快照）`, value: "__saved__" }]
      : []),
    ...items
      .filter((item) => item.available)
      .map((item) => ({ label: `${item.title} · ${Math.round(item.duration)} 秒`, value: item.id }))
  ];
});
const musicUrl = computed(() =>
  musicId.value === "__saved__"
    ? resolveBackendUrl(
        `/api/v1/tools/media-archive/items/${props.item.id}/media/${current.value?.id ?? props.mediaId}/saved-music?v=${current.value?.audioEdit?.music?.checksum ?? ""}`
      )
    : musicId.value === "__original__" && originalMusic.value
      ? resolveBackendUrl(originalMusic.value.previewUrl)
      : chosenMusic.value
        ? resolveBackendUrl(chosenMusic.value.audioUrl)
        : ""
);
let scope = new AbortController(),
  timer: ReturnType<typeof setTimeout> | undefined,
  generation = 0,
  musicRequest = 0;
function dispose() {
  scope.abort();
  if (timer) clearTimeout(timer);
  video.value?.pause();
  musicRange.value?.stop();
}
onScopeDispose(dispose);
function beforeUnload(event: BeforeUnloadEvent) {
  if (props.show && initialized.value && !activeJob.value && recipe.value !== initialRecipe.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
window.addEventListener("beforeunload", beforeUnload);
onScopeDispose(() => window.removeEventListener("beforeunload", beforeUnload));
watch(
  // 同一作品的保存结果会由父页面回写，不能因此中断刚创建的编辑画面任务。
  [() => props.show, () => props.item.id, () => props.mediaId],
  async ([show]) => {
    dispose();
    scope = new AbortController();
    const version = ++generation;
    if (!show) return;
    error.value = "";
    job.value = undefined;
    submitting.value = false;
    syncingResult.value = false;
    uploading.value = false;
    initialized.value = false;
    ready.value = false;
    applyMedia(props.item.media.find((entry) => entry.id === props.mediaId));
    try {
      const [runtime, jobs] = await Promise.all([
        videoEditApi.runtime(scope.signal),
        videoEditApi.list(props.item.id, props.mediaId, scope.signal),
        loadMusic()
      ]);
      if (version !== generation || scope.signal.aborted) return;
      ready.value = runtime.ready;
      job.value = jobs.find((entry) => ["pending", "running"].includes(entry.status));
      if (job.value) schedulePoll(version);
      if (props.initialMusicId && /^[A-Za-z0-9_-]{1,80}$/.test(props.initialMusicId)) {
        const selected = await audioLibraryApi.item(props.initialMusicId);
        if (version !== generation || scope.signal.aborted) return;
        if (!selected.deletedAt && selected.available) {
          chosenMusic.value = selected;
          musicId.value = selected.id;
          settings.musicStartSeconds = 0;
        }
      }
    } catch (e) {
      if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
    } finally {
      if (version === generation) initialized.value = true;
    }
  },
  { immediate: true }
);
function applyMedia(media?: ContentArchiveMedia) {
  current.value = media ? structuredClone(toRaw(media)) : undefined;
  loadWatermark(current.value);
  videoDuration.value = (media?.durationMs ?? 0) / 1000;
  originalDuration.value = 0;
  Object.assign(settings, media?.audioEdit?.settings ?? defaultArchiveAudioSettings());
  musicId.value = media?.audioEdit?.music
    ? "__saved__"
    : media?.kind === "image" && originalMusic.value
      ? "__original__"
      : null;
  chosenMusic.value = undefined;
  basePreviewUrl.value = "";
  basePreviewJob.value = undefined;
  basePreviewFailed.value = false;
  viewingOriginal.value = false;
  previewUrl.value = savedUrl.value;
  previewIsDraft.value = false;
  initialRecipe.value = recipe.value;
}
async function loadMusic() {
  const request = ++musicRequest,
    version = generation;
  try {
    const result = await audioLibraryApi.list(
      { view: "music", keyword: keyword.value, page: musicPage.value },
      scope.signal
    );
    if (request !== musicRequest || version !== generation || scope.signal.aborted) return;
    music.value = result.items;
    musicTotal.value = result.total;
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  }
}
function searchMusic() {
  musicPage.value = 1;
  void loadMusic();
}
function chooseMusic(id: string | null) {
  musicId.value = id;
  chosenMusic.value = music.value.find((entry) => entry.id === id);
  settings.musicStartSeconds = id === "__saved__" ? (current.value?.audioEdit?.settings.musicStartSeconds ?? 0) : 0;
}
async function uploadMusic(event: Event) {
  const element = event.target as HTMLInputElement,
    file = element.files?.[0];
  element.value = "";
  if (!file || busy.value) return;
  if (file.size > 100 * 1024 * 1024) {
    error.value = "音乐文件最大 100 MiB";
    return;
  }
  const version = generation;
  uploading.value = true;
  try {
    const result = await audioLibraryApi.upload(file, { purpose: "music" }, undefined, scope.signal);
    if (version !== generation || scope.signal.aborted) return;
    chosenMusic.value = result.item;
    musicId.value = result.item.id;
    settings.musicStartSeconds = 0;
    await loadMusic();
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (version === generation) uploading.value = false;
  }
}
function viewOriginal() {
  video.value?.pause();
  previewUrl.value = originalUrl.value;
  previewIsDraft.value = false;
  viewingOriginal.value = true;
}
function viewCurrent() {
  video.value?.pause();
  previewUrl.value = panel.value === "watermark" ? watermarkBaseUrl.value : savedUrl.value;
  previewIsDraft.value = false;
  viewingOriginal.value = false;
}
function recordDuration(value: number) {
  if (!previewIsDraft.value && Number.isFinite(value) && value > 0)
    videoDuration.value = originalDuration.value || value;
}
function recordOriginalDuration(event: Event) {
  const element = event.currentTarget as HTMLVideoElement;
  if (element.getAttribute("src") !== originalUrl.value || !Number.isFinite(element.duration) || element.duration <= 0)
    return;
  originalDuration.value = element.duration;
  videoDuration.value = element.duration;
}
function previewError() {
  if (basePreviewUrl.value && previewUrl.value === basePreviewUrl.value) {
    basePreviewUrl.value = "";
    basePreviewFailed.value = true;
    previewUrl.value = savedUrl.value;
    error.value = "水印编辑画面已过期或加载失败，请重试；当前已保存视频保留";
  }
}
function seekWatermark(time: number) {
  viewCurrent();
  if (video.value) video.value.currentTime = Math.min(videoDuration.value, Math.max(0, time));
}
watch(panel, (value) => {
  if (!activeJob.value) viewCurrent();
  if (value === "watermark") prepareWatermarkBase();
});
function prepareWatermarkBase() {
  if (
    panel.value === "watermark" &&
    initialized.value &&
    ready.value &&
    !busy.value &&
    current.value?.audioEdit?.watermark &&
    !basePreviewUrl.value &&
    !basePreviewFailed.value
  )
    void submit("preview", true);
}
watch([initialized, () => current.value?.checksum], prepareWatermarkBase);
watch(
  watermarkInput,
  () => {
    if (panel.value === "watermark" && !activeJob.value) viewCurrent();
  },
  { deep: true }
);
async function submit(mode: ArchiveVideoEditInput["mode"], cleanWatermarkBase = false) {
  if (!current.value || busy.value || scope.signal.aborted) return;
  if (!cleanWatermarkBase && mode !== "restore" && watermarkValidation.value) {
    error.value = watermarkValidation.value;
    return;
  }
  video.value?.pause();
  error.value = "";
  musicRange.value?.stop();
  const version = generation;
  submitting.value = true;
  const images = props.item.media.filter((entry) => entry.kind === "image" && !entry.frameSourceMediaId);
  if (isImage.value && images.length > 100) {
    error.value = "图集生成视频每次最多支持 100 张原图";
    submitting.value = false;
    return;
  }
  const input: ArchiveVideoEditInput = {
    mode,
    revision: current.value.audioEdit?.revision ?? 0,
    checksum: current.value.checksum,
    useSavedMusic: musicId.value === "__saved__",
    ...(musicId.value === "__original__" && originalMusic.value
      ? { sourceMusicId: originalMusic.value.id, sourceMusicChecksum: originalMusic.value.checksum }
      : {}),
    settings: { ...settings },
    ...(isImage.value
      ? {}
      : {
          watermark:
            mode !== "restore" && watermarkInput.value
              ? { ...watermarkInput.value, settings: JSON.parse(JSON.stringify(watermarkSettings.value)) }
              : null
        }),
    previewStartSeconds: panel.value === "audio" || cleanWatermarkBase ? 0 : previewStart.value,
    previewFullLength: mode === "preview" && (panel.value === "audio" || cleanWatermarkBase),
    ...(isImage.value
      ? {
          slideshow: {
            images: props.item.media
              .filter((entry) => entry.kind === "image" && !entry.frameSourceMediaId)
              .map((entry) => ({ id: entry.id, checksum: entry.checksum })),
            secondsPerImage: secondsPerImage.value,
            aspect: aspect.value
          }
        }
      : {}),
    ...(chosenMusic.value && musicId.value !== "__saved__"
      ? { musicId: chosenMusic.value.id, musicRevision: chosenMusic.value.revision }
      : {})
  };
  if (cleanWatermarkBase) {
    input.useSavedMusic = Boolean(current.value.audioEdit?.music);
    input.settings = structuredClone(toRaw(current.value.audioEdit?.settings ?? defaultArchiveAudioSettings()));
    input.watermark = null;
    delete input.musicId;
    delete input.musicRevision;
    delete input.sourceMusicId;
    delete input.sourceMusicChecksum;
  }
  try {
    const result = await videoEditApi.create(props.item.id, current.value.id, input, scope.signal);
    if (version !== generation || scope.signal.aborted) return;
    job.value = result;
    if (cleanWatermarkBase) {
      basePreviewJob.value = result.id;
      basePreviewFailed.value = false;
    }
    schedulePoll(version);
  } catch (e) {
    if (cleanWatermarkBase && version === generation) basePreviewFailed.value = true;
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (version === generation) submitting.value = false;
  }
}
function schedulePoll(version: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void poll(version), 750);
}
async function poll(version: number) {
  if (!job.value || scope.signal.aborted || version !== generation) return;
  const jobId = job.value.id;
  try {
    const result = await videoEditApi.get(jobId, scope.signal);
    if (scope.signal.aborted || version !== generation || job.value?.id !== jobId) return;
    job.value = result;
    if (["pending", "running"].includes(result.status)) schedulePoll(version);
    else if (result.status === "completed") {
      if (result.mode === "preview" && result.previewUrl) {
        previewUrl.value = resolveBackendUrl(result.previewUrl);
        if (result.id === basePreviewJob.value) {
          basePreviewUrl.value = previewUrl.value;
          if (panel.value !== "watermark") previewUrl.value = savedUrl.value;
          basePreviewJob.value = undefined;
          previewIsDraft.value = false;
          viewingOriginal.value = false;
        } else {
          previewIsDraft.value = true;
          viewingOriginal.value = false;
        }
      } else {
        // 终态与详情同步视为同一次操作，避免旧版本尚未回写就接受下一次保存。
        syncingResult.value = true;
        try {
          const item = await contentArchiveApi.detail(props.item.id, scope.signal);
          if (scope.signal.aborted || version !== generation || job.value?.id !== jobId) return;
          applyMedia(item.media.find((entry) => entry.id === (result.resultMediaId ?? props.mediaId)));
          emit("saved", item);
        } finally {
          if (version === generation) syncingResult.value = false;
        }
      }
      prepareWatermarkBase();
    } else if (result.id === basePreviewJob.value) {
      basePreviewJob.value = undefined;
      basePreviewFailed.value = true;
    }
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  }
}
async function cancel() {
  if (!job.value) return;
  const version = generation;
  try {
    const result = await videoEditApi.cancel(job.value.id, scope.signal);
    if (version === generation && !scope.signal.aborted) job.value = result;
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  }
}
async function restore() {
  const version = generation;
  if (
    await confirm("将原片设为最新版本，移除当前成品的配乐、音量修改和水印。音乐库素材、原片和截帧均保留。", {
      title: "恢复原始视频",
      positiveText: "恢复原片"
    })
  )
    if (version === generation && !scope.signal.aborted) await submit("restore");
}
async function canLeave() {
  const version = generation;
  if (
    !activeJob.value &&
    initialized.value &&
    recipe.value !== initialRecipe.value &&
    !(await confirm("未保存的参数不会写入归档，已上传到音乐库的素材保留；未保存的水印草稿 24 小时后清理。", {
      title: "关闭配乐编辑",
      positiveText: "关闭窗口",
      danger: false
    }))
  )
    return false;
  return version === generation && !scope.signal.aborted;
}
async function close() {
  if (await canLeave()) emit("update:show", false);
}
defineExpose({ canLeave, close });
</script>

<style scoped>
.audio-editor {
  width: min(1120px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
}
.audio-editor.is-embedded {
  width: 100%;
  max-height: none;
}
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  margin: 16px 0;
}
.editor-preview,
.editor-controls {
  min-width: 0;
}
.editor-preview :deep(video) {
  width: 100%;
  max-height: 56vh;
  background: #101418;
  border-radius: 10px;
  display: block;
  object-fit: contain;
}
.slideshow-image {
  width: 100%;
  max-height: 56vh;
  object-fit: contain;
  background: #f1f5f9;
}
.editor-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-controls label {
  display: grid;
  gap: 8px;
}
.editor-controls audio {
  width: 100%;
}
.editor-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0;
}
.editor-actions :deep(.n-input-number) {
  width: 130px;
}
.editor-actions :deep(.n-select),
.editor-actions :deep(.n-input) {
  flex: 1;
  min-width: 130px;
}
.editor-fades {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.editor-footer {
  justify-content: flex-end;
}
.editor-hint,
small {
  color: var(--text-secondary, #64748b);
  line-height: 1.7;
}
@media (max-width: 800px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
}
</style>
