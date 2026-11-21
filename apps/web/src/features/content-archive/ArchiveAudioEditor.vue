<template>
  <component
    :is="embedded ? 'section' : NModal"
    v-bind="embedded ? {} : { show, maskClosable: false }"
    @update:show="close"
  >
    <n-card
      :title="isImage ? '图集生成配乐视频' : '编辑视频：粗剪、配乐与水印'"
      class="audio-editor"
      :class="{ 'is-embedded': embedded }"
      closable
      @close="close"
    >
      <p class="editor-hint">从原片生成，支持粗剪、配乐与水印。保存后详情与下载使用最新成品，原片保留。</p>
      <n-alert v-if="error || watermarkError" type="error"
        >{{ error || watermarkError
        }}<n-button v-if="activeJob" size="small" @click="schedulePoll(generation)">重试状态</n-button></n-alert
      >
      <n-alert v-if="!ready && initialized" type="warning"
        >需要已安装的 FFmpeg 共享媒体运行时；请在能力管理中检查后重新打开。</n-alert
      >
      <div class="editor-layout" :class="{ 'is-portrait': portraitPreview }">
        <section class="editor-preview">
          <div v-if="!isImage && panel === 'cut'" class="preview-toolbar">
            <strong>视频预览</strong>
            <n-button
              size="small"
              :type="portraitPreview ? 'primary' : 'default'"
              :disabled="busy"
              @click="changePreviewAspect('9:16')"
              >竖屏</n-button
            >
            <n-button
              size="small"
              :type="!portraitPreview ? 'primary' : 'default'"
              :disabled="busy"
              @click="changePreviewAspect('16:9')"
              >横屏</n-button
            >
            <n-select
              :value="roughCut.frameSettings.value.aspect"
              :disabled="busy || !roughCut.loaded.value"
              :options="previewAspectOptions"
              aria-label="成片画幅比例"
              @update:value="changePreviewAspect"
            />
          </div>
          <ArchiveWatermarkPreview
            :class="{ 'video-stage': !isImage || previewIsDraft }"
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
            @time="recordPlayhead"
            @duration="recordDuration"
          >
            <video
              v-if="!isImage || previewIsDraft"
              ref="video"
              v-show="!cutPictureActive"
              :key="previewUrl"
              :src="previewUrl"
              :controls="panel !== 'cut' || previewIsDraft"
              playsinline
              :preload="panel === 'cut' ? 'auto' : 'metadata'"
              @play="
                musicRange?.stop();
                roughCut.onPlay();
              "
              @timeupdate="roughCut.sync()"
              @ended="roughCut.onEnded()"
              @loadedmetadata="roughCut.onReady()"
              @error="previewError"
            />
            <ArchiveCutPicture
              v-if="cutPictureActive"
              :video="video"
              :frame="roughCut.frameSettings.value"
              :subtitles="roughCut.studio.value.subtitles"
              :clips="roughCut.clips.value"
              :gap="roughCut.isGap.value"
              :time="roughCut.time.value"
              :source-width="roughCut.sourceWidth.value"
              :source-height="roughCut.sourceHeight.value"
            />
            <img v-if="isImage && !previewIsDraft" class="slideshow-image" :src="previewUrl" alt="图集原图预览" />
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
                  { label: '竖版 3:4（720 × 960）', value: 'portrait_3_4' },
                  { label: '横版 1280 × 720', value: 'landscape' },
                  { label: '方形 1080 × 1080', value: 'square' }
                ]"
            /></label>
          </div>
          <p v-if="isImage" class="editor-hint">
            按原图顺序生成附加视频，不足 15 秒时循环至完整一轮结束；原图不会被替换。
          </p>
          <p v-if="panel !== 'cut'">
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
            <n-button v-if="panel !== 'cut'" @click="viewOriginal">{{
              isImage ? "查看原图" : "查看原始视频"
            }}</n-button>
            <n-button v-if="viewingOriginal && !isImage && panel !== 'cut'" @click="viewCurrent"
              >查看当前已保存视频</n-button
            >
            <n-input-number
              v-if="panel === 'watermark'"
              v-model:value="previewStart"
              :min="0"
              :max="Math.max(0, editDuration - 0.1)"
              :disabled="busy"
              aria-label="试听起点秒数"
            />
            <n-button
              :disabled="busy || !ready || Boolean(watermarkValidation) || (panel === 'cut' && !roughCut.loaded.value)"
              @click="submit('preview')"
              >{{
                panel === "watermark" ? "生成 15 秒水印效果" : panel === "cut" ? "生成完整效果" : "试听完整视频效果"
              }}</n-button
            >
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
          <div v-if="!isImage" class="inspector-tabs" role="tablist" aria-label="素材操作分类">
            <n-button
              v-for="entry in inspectorTabs"
              :key="entry.value"
              size="small"
              :type="inspector === entry.value ? 'primary' : 'default'"
              :disabled="busy"
              role="tab"
              :aria-selected="inspector === entry.value"
              @click="selectInspector(entry.value)"
              >{{ entry.label }}</n-button
            >
          </div>
          <template v-if="panel === 'cut' && !isImage && inspector === 'video'">
            <p v-if="roughCut.loading.value" role="status">正在读取原片和粗剪草稿…</p>
            <n-alert v-if="roughCut.error.value" type="error"
              >{{ roughCut.error.value
              }}<n-button size="small" @click="roughCut.loaded.value ? roughCut.flush() : roughCut.load()"
                >重试</n-button
              ></n-alert
            >
            <div class="cut-overview">
              原片 {{ roughCut.sourceDuration.value.toFixed(2) }} 秒 · 成片 {{ roughCut.duration.value.toFixed(2) }} 秒
            </div>
            <ArchiveCutSettings
              v-if="roughCut.loaded.value"
              :clips="roughCut.clips.value"
              :selected="roughCut.selected.value"
              :frame="roughCut.frameSettings.value"
              :source-duration="
                roughCut.durationFor(roughCut.clips.value.find((clip) => clip.id === roughCut.selected.value[0]))
              "
              :source-width="roughCut.sourceWidth.value"
              :source-height="roughCut.sourceHeight.value"
              :fps="roughCut.fpsFor(roughCut.clips.value.find((clip) => clip.id === roughCut.selected.value[0]))"
              :disabled="busy || previewIsDraft"
              @clip="roughCut.updateClip"
              @frame="roughCut.updateFrame"
              @duplicate="roughCut.duplicate"
            />
            <small>{{
              previewIsDraft ? "当前为生成后的完整效果" : "当前为粗剪预览，转场、配乐与水印请生成完整效果查看。"
            }}</small>
            <n-button :disabled="busy || !roughCut.loaded.value" @click="roughCut.resetClips()"
              >恢复完整时间线</n-button
            >
            <n-button v-if="previewIsDraft" :disabled="busy" @click="viewCut">返回粗剪预览</n-button>
            <small role="status">{{ roughCut.draftStatus.value }}</small>
          </template>
          <ArchiveWatermarkControls
            v-else-if="panel === 'watermark' && !isImage"
            v-model:settings="watermarkSettings"
            v-model:selected-point="selectedPoint"
            v-model:selected-frame="selectedFrame"
            :asset="watermarkAsset"
            :disabled="busy"
            :duration="editDuration"
            :time="playhead"
            @upload="uploadWatermark"
            @select-library="selectLibraryWatermark"
            @remove="removeWatermark"
            @move="moveWatermark"
            @seek="seekWatermark"
          />
          <template v-else-if="panel === 'audio' || isImage">
            <label v-if="!isImage"
              >视频原声音量 {{ settings.originalVolume }}%<n-slider
                v-model:value="settings.originalVolume"
                v-slider-label="{ label: '视频原声音量', text: `${settings.originalVolume}%` }"
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
                v-slider-label="{ label: '背景音乐音量', text: `${settings.musicVolume}%` }"
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
                  query: {
                    archiveId: item.id,
                    mediaId,
                    returnTo: conversionReturnTo
                  }
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
          <ArchiveStudioPanel
            v-if="!isImage && panel === 'cut' && inspector !== 'video' && roughCut.loaded.value"
            :active-tab="inspector"
            :item-id="item.id"
            :media-id="mediaId"
            :clips="roughCut.clips.value"
            :selected="roughCut.selected.value"
            :studio="roughCut.studio.value"
            :time="roughCut.time.value"
            :duration="roughCut.duration.value"
            :disabled="busy || previewIsDraft"
            @studio="roughCut.updateStudio"
            @source="roughCut.appendSource"
            @seek="seekCut"
            @analysis="roughCut.applyAnalysis"
          />
        </section>
      </div>
      <ArchiveCutTimeline
        v-if="!isImage && panel === 'cut' && roughCut.loaded.value"
        :clips="roughCut.clips.value"
        v-model:selected="roughCut.selected.value"
        :time="roughCut.time.value"
        :duration="roughCut.duration.value"
        :source-duration="roughCut.sourceDuration.value"
        :fps="roughCut.fps.value"
        v-model:zoom="roughCut.zoom.value"
        v-model:snapping="roughCut.snapping.value"
        :can-trim="roughCut.canTrim.value"
        :can-undo="Boolean(roughCut.undo.value.length)"
        :can-redo="Boolean(roughCut.redo.value.length)"
        :can-paste="roughCut.canPaste.value"
        :source-url="originalUrl"
        :source-urls="roughCut.sourceUrls.value"
        :sources="roughCut.studio.value.sources"
        :studio="roughCut.studio.value"
        @studio="roughCut.updateStudio"
        :disabled="busy || previewIsDraft"
        @seek="seekCut"
        @play="roughCut.togglePlay"
        @split="roughCut.split"
        @trim="roughCut.trim"
        @remove="roughCut.remove"
        @duplicate="roughCut.duplicate"
        @copy="roughCut.copySelection"
        @paste="roughCut.paste"
        @undo="roughCut.undoEdit"
        @redo="roughCut.redoEdit"
        @begin="roughCut.begin"
        @commit="roughCut.commit"
        @layout="roughCut.commitLayout"
        @cancel="roughCut.cancelGesture"
      />
      <template #footer
        ><div class="editor-actions editor-footer">
          <n-button :disabled="busy || !current?.audioEdit" @click="restore">恢复原始视频</n-button>
          <n-button
            v-if="!isImage"
            :disabled="
              busy ||
              !ready ||
              !initialized ||
              Boolean(watermarkValidation) ||
              (panel === 'cut' && !roughCut.loaded.value) ||
              (roughCut.loaded.value && !roughCut.clips.value.length)
            "
            @click="submit('preview', false, true)"
            >导出视频</n-button
          >
          <n-button v-if="exportedUrl" tag="a" :href="exportedUrl">下载生成的视频</n-button>
          <n-button @click="close">关闭窗口</n-button>
          <n-button
            type="primary"
            :loading="submitting"
            :disabled="
              busy ||
              !ready ||
              !initialized ||
              Boolean(watermarkValidation) ||
              (panel === 'cut' && !roughCut.loaded.value) ||
              (roughCut.loaded.value && !roughCut.clips.value.length)
            "
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
import { vSliderLabel } from "../../shared/ui/slider-label";
import { computed, onScopeDispose, reactive, ref, watch, toRaw, nextTick } from "vue";
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
  archiveSlideshowDuration,
  archiveProjectDuration,
  archiveFrameGeometry,
  type ArchiveFrame,
  watermarkTimingError,
  type ArchiveSlideshowAspect,
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
import ArchiveCutTimeline from "./ArchiveCutTimeline.vue";
import ArchiveStudioPanel from "./ArchiveStudioPanel.vue";
import ArchiveCutSettings from "./ArchiveCutSettings.vue";
import ArchiveCutPicture from "./ArchiveCutPicture.vue";
import { useArchiveRoughCut } from "./useArchiveRoughCut";
import { useArchiveWatermark } from "./useArchiveWatermark";
const props = defineProps<{
  show: boolean;
  item: ContentArchiveItem;
  mediaId: string;
  embedded?: boolean;
  initialPanel?: "audio" | "watermark" | "cut";
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
  watermarkInput.value ? watermarkTimingError(watermarkSettings.value, editDuration.value) : undefined
);
const isImage = computed(() => current.value?.kind === "image");
const secondsPerImage = ref(3),
  aspect = ref<ArchiveSlideshowAspect>("portrait");
const editDuration = computed(() =>
  isImage.value
    ? archiveSlideshowDuration(
        props.item.media.filter((entry) => entry.kind === "image" && !entry.frameSourceMediaId).length,
        secondsPerImage.value
      )
    : roughCut.loaded.value
      ? roughCut.duration.value
      : ((current.value?.audioEdit?.cut
          ? archiveProjectDuration(current.value.audioEdit.cut, current.value.audioEdit.studio)
          : undefined) ?? videoDuration.value)
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
const roughCut = useArchiveRoughCut(
  () => props.item.id,
  () => current.value,
  () => video.value,
  () => panel.value === "cut" && !previewIsDraft.value,
  () => originalUrl.value,
  () => settings.originalVolume,
  (source) =>
    resolveBackendUrl(
      current.value?.audioEdit?.studioSources?.some(
        (entry) => entry.sourceId === source.id && entry.ref.checksum === source.checksum
      )
        ? `/api/v1/tools/media-archive/items/${props.item.id}/media/${props.mediaId}/studio-sources/${source.id}`
        : `/api/v1/tools/media-archive/items/${source.itemId}/media/${source.mediaId}/original`
    ),
  (url) => {
    if (panel.value === "cut" && !previewIsDraft.value) previewUrl.value = url;
  }
);
const cutPictureActive = computed(() => panel.value === "cut" && !previewIsDraft.value && roughCut.loaded.value);
const inspector = ref("video");
const inspectorTabs = [
  { label: "视频", value: "video" },
  { label: "字幕", value: "subtitles" },
  { label: "配乐轨", value: "music" },
  { label: "视频素材", value: "sources" },
  { label: "智能检测", value: "analysis" },
  { label: "整体声音", value: "audio" },
  { label: "水印", value: "watermark" }
];
function selectInspector(value: string) {
  inspector.value = value;
  panel.value = value === "audio" || value === "watermark" ? value : "cut";
}
watch(
  () => roughCut.selected.value,
  (ids) => {
    if (ids.length !== 1) return;
    const id = ids[0];
    if (roughCut.clips.value.some((entry) => entry.id === id)) selectInspector("video");
    else if (roughCut.studio.value.subtitles.some((entry) => entry.id === id)) selectInspector("subtitles");
    else if (roughCut.studio.value.musicTracks.some((entry) => entry.id === id)) selectInspector("music");
  },
  { deep: true }
);
watch(
  panel,
  (value) => {
    if (value === "audio" || value === "watermark") inspector.value = value;
    else if (inspector.value === "audio" || inspector.value === "watermark") inspector.value = "video";
  },
  { immediate: true }
);
const previewAspectOptions = [
  { label: "原始比例", value: "source" },
  { label: "横屏 16:9", value: "16:9" },
  { label: "竖屏 9:16", value: "9:16" },
  { label: "竖屏 3:4", value: "3:4" },
  { label: "方形 1:1", value: "1:1" }
];
const portraitPreview = computed(() => {
  if (isImage.value) return aspect.value === "portrait" || aspect.value === "portrait_3_4";
  const size = archiveFrameGeometry(
    roughCut.sourceWidth.value || current.value?.width || 1920,
    roughCut.sourceHeight.value || current.value?.height || 1080,
    roughCut.frameSettings.value
  );
  return size.height > size.width;
});
function changePreviewAspect(value: ArchiveFrame["aspect"]) {
  if (busy.value || !roughCut.loaded.value) return;
  roughCut.updateFrame({ ...roughCut.frameSettings.value, aspect: value });
}
const musicRange = ref<InstanceType<typeof ArchiveMusicRange>>();
const viewingOriginal = ref(false),
  basePreviewUrl = ref(""),
  basePreviewJob = ref<string>(),
  basePreviewFailed = ref(false);
const activeJob = computed(() => Boolean(job.value && ["pending", "running"].includes(job.value.status)));
const exportedUrl = ref(""),
  exportJobId = ref<string>();
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
const watermarkBaseUrl = computed(() => basePreviewUrl.value || savedUrl.value);
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
  roughCut.reset();
  exportedUrl.value = "";
  exportJobId.value = undefined;
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
  if (panel.value === "cut" && media)
    void roughCut.load().then(() => {
      if (panel.value === "cut") viewCut();
    });
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
  if (panel.value === "cut" && !previewIsDraft.value) {
    roughCut.error.value = "当前视频素材加载失败，请检查来源视频是否仍可访问，或重新选择素材。";
  }
  if (basePreviewUrl.value && previewUrl.value === basePreviewUrl.value) {
    basePreviewUrl.value = "";
    basePreviewFailed.value = true;
    previewUrl.value = savedUrl.value;
    error.value = "水印编辑画面已过期或加载失败，请重试；当前已保存视频保留";
  }
}
function seekWatermark(time: number) {
  viewCurrent();
  if (video.value) video.value.currentTime = Math.min(editDuration.value, Math.max(0, time));
}
function recordPlayhead(time: number) {
  if (panel.value !== "cut") playhead.value = time;
  else if (previewIsDraft.value) roughCut.time.value = Math.min(roughCut.duration.value, time);
}
function seekCut(time: number) {
  roughCut.stop();
  roughCut.seek(time);
}
function viewCut() {
  video.value?.pause();
  previewUrl.value = originalUrl.value;
  previewIsDraft.value = false;
  viewingOriginal.value = false;
  void roughCut.load().then(async () => {
    await nextTick();
    if (panel.value === "cut" && !previewIsDraft.value) roughCut.seek(roughCut.time.value);
  });
}
watch(panel, (value) => {
  roughCut.stop();
  if (video.value) {
    video.value.playbackRate = 1;
    video.value.volume = 1;
  }
  if (value === "cut") {
    viewCut();
    return;
  }
  if (!activeJob.value) viewCurrent();
  if (value === "watermark") prepareWatermarkBase();
});
function prepareWatermarkBase() {
  if (
    panel.value === "watermark" &&
    initialized.value &&
    ready.value &&
    !busy.value &&
    (current.value?.audioEdit?.watermark || roughCut.loaded.value) &&
    !basePreviewUrl.value &&
    !basePreviewFailed.value
  )
    void submit("preview", true);
}
watch([initialized, () => current.value?.checksum, roughCut.loaded], prepareWatermarkBase);
watch(
  watermarkInput,
  () => {
    if (panel.value === "watermark" && !activeJob.value) viewCurrent();
  },
  { deep: true }
);
watch(
  [roughCut.clips, roughCut.frameSettings, roughCut.studio],
  () => {
    basePreviewUrl.value = "";
    basePreviewFailed.value = false;
    exportedUrl.value = "";
  },
  { deep: true }
);
watch(recipe, () => {
  exportedUrl.value = "";
});
async function submit(mode: ArchiveVideoEditInput["mode"], cleanWatermarkBase = false, exporting = false) {
  if (!current.value || busy.value || scope.signal.aborted) return;
  if (mode !== "restore" && panel.value === "cut" && !roughCut.loaded.value) {
    error.value = "请先等待原片和粗剪草稿读取完成";
    return;
  }
  if (!cleanWatermarkBase && mode !== "restore" && watermarkValidation.value) {
    error.value = watermarkValidation.value;
    return;
  }
  if (mode !== "restore" && roughCut.loaded.value && !roughCut.clips.value.length) {
    error.value = "请至少保留一个视频片段";
    return;
  }
  const version = generation;
  submitting.value = true;
  await roughCut.flush();
  if (scope.signal.aborted || version !== generation) {
    submitting.value = false;
    return;
  }
  video.value?.pause();
  error.value = "";
  musicRange.value?.stop();
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
    ...(roughCut.loaded.value && mode !== "restore"
      ? {
          cut: JSON.parse(JSON.stringify(roughCut.clips.value)),
          frame: { ...roughCut.frameSettings.value },
          studio: JSON.parse(JSON.stringify(roughCut.studio.value))
        }
      : {}),
    ...(isImage.value
      ? {}
      : {
          watermark:
            mode !== "restore" && watermarkInput.value
              ? { ...watermarkInput.value, settings: JSON.parse(JSON.stringify(watermarkSettings.value)) }
              : null
        }),
    previewStartSeconds: panel.value !== "watermark" || cleanWatermarkBase || exporting ? 0 : previewStart.value,
    previewFullLength: mode === "preview" && (panel.value !== "watermark" || cleanWatermarkBase || exporting),
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
    input.watermark = null;
  }
  try {
    const result = await videoEditApi.create(props.item.id, current.value.id, input, scope.signal);
    if (version !== generation || scope.signal.aborted) return;
    job.value = result;
    if (exporting) {
      exportJobId.value = result.id;
      exportedUrl.value = "";
    }
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
        if (result.id === exportJobId.value) exportedUrl.value = resolveBackendUrl(result.previewUrl + "?download=1");
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
    await confirm("将原片设为最新版本，移除当前成品的粗剪、配乐、音量修改和水印。音乐库素材、原片和截帧均保留。", {
      title: "恢复原始视频",
      positiveText: "恢复原片"
    })
  )
    if (version === generation && !scope.signal.aborted) await submit("restore");
}
async function canLeave() {
  await roughCut.flush();
  if (roughCut.draftStatus.value === "草稿保存失败") return false;
  const version = generation;
  if (
    !activeJob.value &&
    initialized.value &&
    recipe.value !== initialRecipe.value &&
    !(await confirm("粗剪草稿会自动保留。未保存的配乐与水印参数不会应用到成品；水印上传草稿保留 24 小时。", {
      title: "关闭视频编辑",
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
}
.audio-editor.is-embedded {
  width: 100%;
  max-height: none;
}
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(340px, 26vw, 560px);
  gap: 24px;
  margin: 16px 0;
}
.editor-layout.is-portrait {
  grid-template-columns: minmax(260px, 0.85fr) minmax(360px, 1.15fr);
}
.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.preview-toolbar :deep(.n-select) {
  width: 160px;
  margin-left: auto;
}
.editor-preview,
.editor-controls {
  min-width: 0;
}
.editor-preview :deep(.video-stage) {
  background: #101418;
  border-radius: 10px;
  height: clamp(280px, 56vh, 680px);
  overflow: hidden;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.editor-preview :deep(video) {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 56vh;
  background: #101418;
  border-radius: 10px;
  display: block;
  margin: 0 auto;
  object-fit: contain;
}
/* 画布与原生视频共同服从预览容器尺寸，避免内部 vh 上限高于容器。 */
.editor-preview :deep(.video-stage > video),
.editor-preview :deep(.video-stage > .cut-picture) {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 0 1 auto;
  object-fit: contain;
  margin: 0;
}
.slideshow-image {
  width: 100%;
  max-height: 56vh;
  object-fit: contain;
  background: #f1f5f9;
}
.editor-controls {
  height: clamp(360px, 68vh, 780px);
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 14px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface, #fff);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.inspector-tabs {
  position: sticky;
  top: -14px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  background: var(--color-surface, #fff);
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
}
.editor-controls > * {
  flex-shrink: 0;
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
  color: var(--text-secondary, var(--color-text-secondary));
  line-height: 1.7;
}
@media (max-width: 800px) {
  .editor-layout,
  .editor-layout.is-portrait {
    grid-template-columns: 1fr;
  }
}
</style>
