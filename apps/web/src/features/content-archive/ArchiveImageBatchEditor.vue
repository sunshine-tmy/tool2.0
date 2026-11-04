<template>
  <n-button v-if="batch.rows.value.length" size="small" secondary @click="opened = true">
    图文处理进度 {{ batch.processed.value }}/{{ batch.rows.value.length }}
  </n-button>
  <n-modal
    v-model:show="opened"
    preset="card"
    :title="kind === 'watermark' ? '图文批量加水印' : '图文批量配乐'"
    style="width: min(960px, 96vw)"
    :mask-closable="false"
  >
    <n-alert type="info" :bordered="false">
      每条图文按原图顺序生成一个附加视频，原图保留。已有相同原图生成的视频时，更新最新一条。
      {{
        useWatermark && useMusic
          ? "水印与配乐一次生成、保存。"
          : useWatermark
            ? "仅替换水印，保留已有配乐。"
            : "仅替换配乐，保留已有水印。"
      }}
      逐条排队，失败不影响其他作品；请保持页面打开。关闭窗口继续处理，离开页面将停止后续提交，已提交任务仍在后台完成。
    </n-alert>
    <n-alert v-if="error" type="error">{{ error }}</n-alert>
    <div class="image-batch-layout">
      <section>
        <div class="image-batch-fields">
          <label
            >新视频每张停留（秒）<n-input-number
              v-model:value="secondsPerImage"
              :min="0.5"
              :max="30"
              :disabled="locked"
          /></label>
          <label>新视频画幅<n-select v-model:value="aspect" :options="aspectOptions" :disabled="locked" /></label>
        </div>
        <small>上述设置只用于首次生成图集视频；已有视频保留原时长和画幅。</small>
        <n-checkbox :checked="addOther" :disabled="locked || loading" @update:checked="toggleOther">
          {{ kind === "watermark" ? "同时添加背景音乐" : "同时添加水印" }}
        </n-checkbox>
        <ArchiveWatermarkSandbox
          v-if="useWatermark"
          ref="watermarkSandbox"
          :active="opened && !previewOpened"
          :disabled="locked || loading"
          :width="virtualSize.width"
          :height="virtualSize.height"
          :settings="watermarkSettings"
          :asset="asset"
          @time="watermarkTime = $event"
          @move="moveWatermark"
        />
        <ArchiveWatermarkControls
          v-if="useWatermark"
          v-model:settings="watermarkSettings"
          v-model:selected-point="selectedPoint"
          v-model:selected-frame="selectedFrame"
          :asset="asset"
          :duration="referenceDuration"
          :time="watermarkTime"
          :disabled="locked || loading"
          @upload="chooseWatermark"
          @select-library="selectWatermark"
          @remove="clearWatermark"
          @move="moveWatermark"
          @seek="watermarkSandbox?.seek($event)"
        />
        <template v-if="useMusic">
          <div class="image-batch-fields">
            <n-input
              v-model:value="keyword"
              placeholder="搜索音频素材"
              :disabled="locked || loading"
              @keyup.enter="searchMusic"
            />
            <n-button :disabled="locked || loading" @click="searchMusic">搜索音乐</n-button>
          </div>
          <n-select
            :value="music?.id ?? null"
            :options="musicOptions"
            :disabled="locked || loading"
            filterable
            placeholder="从音频素材库选择配乐"
            aria-label="批量图文背景音乐"
            @update:value="chooseMusic"
          />
          <n-pagination
            v-if="musicTotal > 20"
            v-model:page="musicPage"
            :item-count="musicTotal"
            :page-size="20"
            :disabled="locked || loading"
            @update:page="loadMusic"
            ><template #prefix>共 {{ musicTotal }} 条</template></n-pagination
          >
          <label
            >配乐音量 {{ musicVolume }}%<n-slider v-model:value="musicVolume" :min="0" :max="100" :disabled="locked"
          /></label>
          <n-checkbox v-model:checked="loop" :disabled="locked">音乐不足时循环到视频结束</n-checkbox>
          <ArchiveMusicRange
            v-if="music"
            v-model:start="musicStart"
            :url="resolveBackendUrl(music.audioUrl)"
            :title="music.title"
            :music-duration="music.duration"
            :video-duration="referenceDuration"
            :disabled="locked"
            :loop="loop"
            :volume="musicVolume"
          />
          <small
            >选段预览以首条作品时长为参考；每条视频从同一音乐起点开始，按各自时长截取或循环。视频原声音量保持不变。</small
          >
          <small>音乐过长自动截断；不循环且音乐不足时，后半段保留原声，无原声则静音，视频长度不变。</small>
        </template>
        <small v-if="useWatermark">
          自动结束会跟随每条视频的实际结尾；手填的起止时间、关键帧按秒复用，超出某条时长时会提示该条，不会自动拉长视频。
        </small>
        <small>右侧可逐条生成完整效果预览，预览不会保存或替换归档。修改参数后需重新预览。</small>
      </section>
      <section class="image-batch-results" aria-label="图文批量处理结果">
        <p role="status">共 {{ batch.rows.value.length }} 条 · 成功 {{ successCount }} · 失败 {{ failedCount }}</p>
        <article v-for="row in batch.rows.value" :key="row.id" :data-item-id="row.id">
          <strong>{{ row.title }}</strong>
          <small>{{
            row.durationSeconds ? `视频时长 ${row.durationSeconds.toFixed(2)} 秒` : "预览或处理时读取该条时长"
          }}</small>
          <n-progress
            class="image-batch-progress"
            type="line"
            :percentage="Math.floor(row.progress)"
            :status="row.status === 'failed' ? 'error' : row.status === 'completed' ? 'success' : 'default'"
          />
          <p>{{ row.message }}</p>
          <div class="image-batch-actions">
            <n-button size="small" secondary :disabled="!canPreview(row)" @click="preview(row.id)">
              {{ row.status === "completed" ? "预览成品" : "预览效果" }}
            </n-button>
            <n-button size="tiny" :disabled="batch.running.value || previewBusy" @click="view(row.id)"
              >查看归档</n-button
            >
          </div>
          <small v-if="row.preview">{{ row.preview.message }}</small>
        </article>
      </section>
    </div>
    <div class="image-batch-actions">
      <n-button type="primary" :disabled="locked || loading || !readyToStart" @click="start"
        >开始批量保存 {{ batch.rows.value.length }} 条</n-button
      >
      <n-button v-if="batch.running.value" :disabled="batch.stopping.value" @click="batch.stop"
        >停止后续处理（当前项继续）</n-button
      >
      <n-button v-if="batch.paused.value && !hasUncertain" :disabled="batch.running.value" @click="batch.run()"
        >同步任务状态并继续</n-button
      >
      <n-button v-if="hasUncertain" :disabled="batch.running.value" @click="skipUncertain">跳过待核对项并继续</n-button>
      <n-button
        v-if="canRetry"
        :disabled="batch.running.value || batch.paused.value"
        @click="batch.run(undefined, true)"
        >重试失败 / 未提交项</n-button
      >
      <n-button @click="opened = false">{{ batch.running.value ? "收起并继续" : "关闭" }}</n-button>
    </div>
  </n-modal>
  <n-modal
    v-model:show="previewOpened"
    preset="card"
    :title="`图文视频预览 · ${previewRow?.title ?? ''}`"
    style="width: min(820px, 96vw)"
  >
    <p v-if="previewRow?.preview?.source === 'saved'">当前已保存成品</p>
    <p v-else>完整效果预览，尚未保存；每条视频按自身时长生成。</p>
    <n-progress
      v-if="previewRow?.preview?.status === 'running'"
      class="image-batch-progress"
      type="line"
      :percentage="Math.floor(previewRow.preview.progress)"
    />
    <video
      v-if="previewOpened && previewRow?.preview?.url"
      :key="previewRow.preview.url"
      ref="previewVideo"
      class="image-batch-video"
      :src="resolveBackendUrl(previewRow.preview.url)"
      controls
      playsinline
      preload="metadata"
      @loadedmetadata="previewLoaded"
      @error="previewFailed"
    />
    <p role="status">{{ previewRow?.preview?.message ?? "参数已更改，请重新生成预览" }}</p>
    <p v-if="previewRow?.durationSeconds">本条视频时长 {{ previewRow.durationSeconds.toFixed(2) }} 秒</p>
    <div class="image-batch-actions">
      <n-button
        v-if="previewRow && ['failed', 'stopped', undefined].includes(previewRow.preview?.status)"
        :disabled="!canPreview(previewRow)"
        @click="preview(previewRow.id)"
        >重新预览</n-button
      >
      <n-button
        v-if="previewRow?.preview?.status === 'running' && !batch.previewing.value"
        @click="preview(previewRow.id)"
        >继续读取预览</n-button
      >
      <n-button
        v-if="previewRow?.preview?.status === 'running' && previewRow.preview.jobId"
        :loading="batch.cancellingPreview.value"
        @click="batch.stopPreview"
        >停止生成预览</n-button
      >
      <n-button @click="previewOpened = false">关闭预览</n-button>
    </div>
  </n-modal>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import {
  NAlert,
  NButton,
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
  defaultArchiveWatermarkSettings,
  type ContentArchiveItem,
  type ContentArchiveListItem,
  type ArchiveWatermarkLibraryItem
} from "@toolbox/shared/archive";
import type { AudioLibraryItemView } from "@toolbox/shared/audio-library";
import { archiveMusicLibraryApi } from "../audio-library/integrations/music";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { archiveDisplayTitle } from "./presentation";
import { contentArchiveApi } from "./content-api";
import { videoEditApi } from "./video-edit-api";
import { imageBatchTarget, type ImageBatchRecipe } from "./image-batch-recipe";
import { useArchiveImageBatch } from "./useArchiveImageBatch";
import ArchiveWatermarkControls from "./ArchiveWatermarkControls.vue";
import ArchiveMusicRange from "./ArchiveMusicRange.vue";
import ArchiveWatermarkSandbox from "./ArchiveWatermarkSandbox.vue";
import { moveArchiveWatermarkPoint } from "./useArchiveWatermark";

const emit = defineEmits<{ updated: [item: ContentArchiveItem]; finished: []; openArchive: [id: string] }>();
const scope = useRequestScope(),
  confirm = useConfirmDialog();
const batch = useArchiveImageBatch(
  (item) => emit("updated", item),
  () => emit("finished")
);
const opened = ref(false),
  kind = ref<"watermark" | "audio">("watermark"),
  loading = ref(false),
  error = ref("");
const started = ref(false),
  addOther = ref(false),
  secondsPerImage = ref<number | null>(3),
  aspect = ref<ImageBatchRecipe["aspect"]>("portrait");
const reference = ref<ContentArchiveItem>();
const useWatermark = computed(() => kind.value === "watermark" || addOther.value);
const useMusic = computed(() => kind.value === "audio" || addOther.value);
const watermarkSettings = ref(defaultArchiveWatermarkSettings()),
  selectedPoint = ref<"from" | "to">("from"),
  selectedFrame = ref(0);
const watermarkFile = ref<File>(),
  watermarkLibrary = ref<ArchiveWatermarkLibraryItem>(),
  localUrl = ref(""),
  localSize = ref<{ width: number; height: number }>();
const asset = computed(() =>
  watermarkLibrary.value
    ? { ...watermarkLibrary.value, url: resolveBackendUrl(watermarkLibrary.value.previewUrl) }
    : localUrl.value && localSize.value
      ? { ...localSize.value, url: localUrl.value }
      : undefined
);
const musicItems = ref<AudioLibraryItemView[]>([]),
  music = ref<AudioLibraryItemView>(),
  keyword = ref(""),
  musicPage = ref(1),
  musicTotal = ref(0);
const musicVolume = ref(20),
  musicStart = ref(0),
  loop = ref(true);
const musicOptions = computed(() =>
  [...new Map([...(music.value ? [music.value] : []), ...musicItems.value].map((item) => [item.id, item])).values()]
    .filter((item) => item.available && !item.deletedAt)
    .map((item) => ({ label: `${item.title} · ${Math.round(item.duration)} 秒`, value: item.id }))
);
const previewOpened = ref(false),
  previewId = ref<string>(),
  previewVideo = ref<HTMLVideoElement>();
const previewRow = computed(() => batch.rows.value.find((row) => row.id === previewId.value));
const previewBusy = computed(
  () => batch.previewing.value || batch.previewPending.value || batch.cancellingPreview.value
);
const locked = computed(() => started.value || batch.running.value || previewBusy.value);
const referenceDuration = computed(() => {
  if (!reference.value) return 0;
  const { media, images, existing } = imageBatchTarget(reference.value);
  return existing ? (media.durationMs ?? 0) / 1000 : images.length * (secondsPerImage.value ?? 0);
});
const watermarkSandbox = ref<InstanceType<typeof ArchiveWatermarkSandbox>>(),
  watermarkTime = ref(0);
const virtualSize = computed(() => {
  const media = reference.value ? imageBatchTarget(reference.value) : undefined;
  if (media?.existing && media.media.width && media.media.height)
    return { width: media.media.width, height: media.media.height };
  return aspect.value === "portrait"
    ? { width: 720, height: 1280 }
    : aspect.value === "landscape"
      ? { width: 1280, height: 720 }
      : { width: 1080, height: 1080 };
});
function moveWatermark(point: { x: number; y: number }) {
  if (locked.value || loading.value) return;
  const next = moveArchiveWatermarkPoint(watermarkSettings.value, point, selectedPoint.value, selectedFrame.value);
  if (next) watermarkSettings.value = next;
}
const successCount = computed(() => batch.rows.value.filter((row) => row.status === "completed").length);
const failedCount = computed(() => batch.rows.value.filter((row) => row.status === "failed").length);
const canRetry = computed(
  () => started.value && batch.rows.value.some((row) => row.status === "failed" || row.status === "stopped")
);
const hasUncertain = computed(() => batch.rows.value.some((row) => row.status === "uncertain"));
const readyToStart = computed(
  () =>
    Boolean(reference.value) &&
    batch.rows.value.length > 0 &&
    (secondsPerImage.value ?? 0) >= 0.5 &&
    (secondsPerImage.value ?? 0) <= 30 &&
    (!useWatermark.value || Boolean(asset.value)) &&
    (!useMusic.value || Boolean(music.value))
);
const aspectOptions = [
  { label: "竖版 720 × 1280", value: "portrait" },
  { label: "横版 1280 × 720", value: "landscape" },
  { label: "方形 1080 × 1080", value: "square" }
];
let generation = 0,
  musicRequest = 0,
  stopWatermarkRead = () => {};
// 本地 Object URL 区分重复选择的同名文件，避免把旧配方的预览当作新效果。
watch(
  () =>
    JSON.stringify([
      secondsPerImage.value,
      aspect.value,
      useMusic.value,
      music.value?.id,
      music.value?.revision,
      musicVolume.value,
      musicStart.value,
      loop.value,
      useWatermark.value,
      watermarkSettings.value,
      localUrl.value,
      watermarkLibrary.value?.id,
      watermarkLibrary.value?.revision
    ]),
  () => batch.invalidatePreviews()
);
watch([previewOpened, previewId], () => previewVideo.value?.pause(), { flush: "sync" });
watch(referenceDuration, (duration) => {
  const row = batch.rows.value.find((entry) => entry.id === reference.value?.id);
  if (row && !started.value) row.durationSeconds = duration;
});
async function show(mode: "watermark" | "audio", items: ContentArchiveListItem[]) {
  opened.value = true;
  // 重新点击入口只展开当前队列，不覆盖正在运行或尚未核对的任务。
  if (batch.running.value || batch.paused.value || previewBusy.value) return;
  previewOpened.value = false;
  watermarkTime.value = 0;
  kind.value = mode;
  addOther.value = false;
  started.value = false;
  error.value = "";
  reference.value = undefined;
  batch.reset(
    items.filter((item) => item.type === "image").map((item) => ({ id: item.id, title: archiveDisplayTitle(item) }))
  );
  if (!batch.rows.value.length) return;
  const version = ++generation;
  loading.value = true;
  try {
    const item = await contentArchiveApi.detail(batch.rows.value[0].id, scope.signal);
    imageBatchTarget(item);
    if (scope.aborted || version !== generation) return;
    reference.value = item;
    if (mode === "audio") await loadMusic();
  } catch (e) {
    if (!scope.aborted && version === generation) error.value = formatApiError(e);
  } finally {
    if (!scope.aborted && version === generation) loading.value = false;
  }
}
async function loadMusic() {
  const version = generation;
  const request = ++musicRequest;
  try {
    const result = await archiveMusicLibraryApi.list(
      { view: "all", keyword: keyword.value, page: musicPage.value },
      scope.signal
    );
    if (scope.aborted || version !== generation || request !== musicRequest) return;
    musicItems.value = result.items;
    musicTotal.value = result.total;
  } catch (e) {
    if (!scope.aborted && version === generation && request === musicRequest) error.value = formatApiError(e);
  }
}
function searchMusic() {
  musicPage.value = 1;
  void loadMusic();
}
function toggleOther(checked: boolean) {
  if (locked.value || loading.value) return;
  addOther.value = checked;
  if (useMusic.value) void loadMusic();
}
function chooseMusic(id: string) {
  music.value = musicItems.value.find((item) => item.id === id) ?? (music.value?.id === id ? music.value : undefined);
  musicStart.value = 0;
}
function clearWatermark() {
  if (locked.value) return;
  stopWatermarkRead();
  if (localUrl.value) URL.revokeObjectURL(localUrl.value);
  localUrl.value = "";
  localSize.value = undefined;
  watermarkFile.value = undefined;
  watermarkLibrary.value = undefined;
}
function chooseWatermark(file: File) {
  if (locked.value) return;
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
    error.value = "水印仅支持不超过 20 MiB 的 PNG、JPG、WebP 静态图片";
    return;
  }
  clearWatermark();
  watermarkFile.value = file;
  localUrl.value = URL.createObjectURL(file);
  const url = localUrl.value;
  let image: HTMLImageElement | undefined = new Image();
  stopWatermarkRead = () => {
    if (image) {
      image.onload = null;
      image.onerror = null;
    }
    image = undefined;
  };
  image.onload = () => {
    if (scope.aborted || localUrl.value !== url || !image) return;
    if (image.naturalWidth > 0 && image.naturalHeight > 0)
      localSize.value = { width: image.naturalWidth, height: image.naturalHeight };
    else {
      clearWatermark();
      error.value = "无法读取水印图片尺寸，请重新选择";
    }
    stopWatermarkRead();
  };
  image.onerror = () => {
    if (scope.aborted || localUrl.value !== url) return;
    clearWatermark();
    error.value = "无法读取水印图片，请选择有效的 PNG、JPG 或 WebP";
  };
  image.src = url;
  error.value = "";
}
async function selectWatermark(id: string) {
  if (locked.value || loading.value) return;
  const version = generation;
  loading.value = true;
  try {
    const items = await videoEditApi.watermarkLibrary(scope.signal);
    if (scope.aborted || version !== generation) return;
    const item = items.find((entry) => entry.id === id);
    if (!item) throw new Error("水印已从库中删除，请重新选择");
    clearWatermark();
    watermarkLibrary.value = item;
    error.value = "";
  } catch (e) {
    if (!scope.aborted && version === generation) error.value = formatApiError(e);
  } finally {
    if (!scope.aborted && version === generation) loading.value = false;
  }
}
function currentRecipe(): ImageBatchRecipe {
  return {
    kind: kind.value,
    secondsPerImage: secondsPerImage.value!,
    aspect: aspect.value,
    ...(useWatermark.value
      ? {
          watermark: {
            settings: watermarkSettings.value,
            file: watermarkFile.value,
            libraryId: watermarkLibrary.value?.id
          }
        }
      : {}),
    ...(useMusic.value
      ? {
          music: {
            id: music.value!.id,
            revision: music.value!.revision,
            volume: musicVolume.value,
            start: musicStart.value,
            loop: loop.value
          }
        }
      : {})
  };
}
async function start() {
  if (locked.value || !readyToStart.value || loading.value) return;
  started.value = true;
  error.value = "";
  previewOpened.value = false;
  await batch.run(currentRecipe());
}
function canPreview(row: (typeof batch.rows.value)[number]) {
  if (row.preview?.status === "completed") return true;
  return (
    !loading.value &&
    !batch.running.value &&
    !batch.paused.value &&
    !batch.cancellingPreview.value &&
    (!batch.previewing.value || batch.previewRowId.value === row.id) &&
    (!batch.previewPending.value || batch.previewRowId.value === row.id) &&
    (row.status === "completed" || readyToStart.value)
  );
}
function preview(id: string) {
  const row = batch.rows.value.find((entry) => entry.id === id);
  if (!row || !canPreview(row)) return;
  previewId.value = id;
  previewOpened.value = true;
  void batch.preview(id, started.value || row.status === "completed" ? undefined : currentRecipe());
}
function previewLoaded(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  if (video !== previewVideo.value || !previewRow.value || !Number.isFinite(video.duration) || video.duration <= 0)
    return;
  previewRow.value.durationSeconds = video.duration;
}
function previewFailed(event: Event) {
  if (event.currentTarget !== previewVideo.value) return;
  const preview = previewRow.value?.preview;
  if (!preview || preview.status !== "completed") return;
  preview.status = "failed";
  preview.url = undefined;
  preview.message =
    preview.source === "effect" ? "预览已过期或加载失败，可重新生成；归档未改变" : "成品加载失败，可重新读取；归档保留";
}
function view(id: string) {
  if (!batch.running.value && !previewBusy.value) {
    previewOpened.value = false;
    opened.value = false;
    emit("openArchive", id);
  }
}
async function skipUncertain() {
  if (
    await confirm(
      "提交回执未收到，服务端可能已保存。跳过此项不会取消或重复提交，请在归档详情中核对最终成品。继续处理其他作品？",
      { title: "跳过待核对项", positiveText: "跳过并继续", danger: false }
    )
  ) {
    if (scope.aborted) return;
    batch.skipUncertain();
    await batch.run();
  }
}
async function canLeave() {
  if (!batch.running.value && !batch.paused.value && !previewBusy.value) return true;
  return confirm("离开后停止后续图文处理及状态读取，已提交任务仍在后台完成；未保存的预览不会写入归档。", {
    title: "离开批量图文处理",
    positiveText: "离开页面"
  });
}
onBeforeRouteLeave(canLeave);
function beforeUnload(event: BeforeUnloadEvent) {
  if (batch.running.value || batch.paused.value || previewBusy.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
window.addEventListener("beforeunload", beforeUnload);
onScopeDispose(() => {
  generation++;
  stopWatermarkRead();
  previewVideo.value?.pause();
  if (localUrl.value) URL.revokeObjectURL(localUrl.value);
  window.removeEventListener("beforeunload", beforeUnload);
});
defineExpose({ show });
</script>
<style scoped>
.image-batch-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  margin: 18px 0;
}
.image-batch-layout > section {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
}
.image-batch-layout small {
  color: #687386;
  line-height: 1.7;
}
.image-batch-fields {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 12px;
}
.image-batch-fields > * {
  flex: 1 1 140px;
}
.image-batch-results {
  max-height: 65vh;
  overflow: auto;
}
.image-batch-results article {
  border: 1px solid #e6eaf0;
  border-radius: 10px;
  padding: 12px;
  overflow-wrap: anywhere;
}
.image-batch-results article > small {
  display: block;
  margin-top: 6px;
}
.image-batch-progress :deep(.n-progress-icon--as-text) {
  white-space: nowrap;
}
.image-batch-video {
  display: block;
  width: 100%;
  max-height: 60vh;
  background: #101418;
  object-fit: contain;
  border-radius: 10px;
}
.image-batch-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
@media (max-width: 680px) {
  .image-batch-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
