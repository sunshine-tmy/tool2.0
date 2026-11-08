<!-- 中文模块说明：图片压缩前端模块，负责上传、压缩参数和结果展示 -->
<template>
  <ToolLayout class="compression-layout">
    <ToolPageHeader
      title="图片压缩"
      description="批量压缩商品图、详情页素材和社媒图片，压缩后保留清晰度与下载记录。"
      kicker="IMAGE OPTIMIZER"
    >
    </ToolPageHeader>
    <div class="image-compress-workspace">
      <section class="main-column image-compress-main v2-tool-page">
        <section class="workspace-panel image-compress-panel">
          <div class="image-compress-summary">
            <div>
              <span>原始总大小</span>
              <strong>{{ formatBytes(totalOriginalSize) }}</strong>
            </div>
            <div>
              <span>压缩后大小</span>
              <strong>{{ completedItems.length ? formatBytes(totalOutputSize) : "--" }}</strong>
            </div>
            <div>
              <span>节省空间</span>
              <strong :class="{ 'is-larger': totalOutputSize > totalOriginalSize }">{{
                completedItems.length ? savedPercentLabel(totalOriginalSize, totalOutputSize) : "--"
              }}</strong>
            </div>
          </div>
          <div class="image-compress-upload">
            <label
              class="dropzone image-compress-dropzone file-upload-area"
              data-upload-area
              role="button"
              tabindex="0"
              aria-label="添加图片"
              :class="{ 'is-dragging': isDragging }"
              @dragenter.prevent="isDragging = true"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="onDrop"
              @keydown.enter.prevent="fileInput?.click()"
              @keydown.space.prevent="fileInput?.click()"
            >
              <input
                ref="fileInput"
                hidden
                multiple
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="onFileChange"
              />
              <UploadCloud :size="32" aria-hidden="true" />
              <strong>点击上传图片或拖拽文件到此处</strong>
              <span>支持 JPG、PNG、WebP 格式，最多一次选择 10 张</span>
            </label>
          </div>

          <div class="image-result-list">
            <article v-for="item in items" :key="item.id" class="image-result-row">
              <div class="image-thumb">
                <img :src="item.previewUrl" :alt="item.file.name" loading="lazy" decoding="async" />
              </div>
              <div class="image-result-main">
                <div class="image-result-heading">
                  <strong :title="item.file.name">{{ item.file.name }}</strong>
                </div>
                <div class="image-result-details">
                  <span>原始大小：{{ formatBytes(item.file.size) }}</span>
                  <template v-if="item.result">
                    <span>压缩后：{{ formatBytes(item.result.outputSize) }}</span>
                    <span class="image-format-badge">{{ item.result.outputFormat.toUpperCase() }}</span>
                    <span>尺寸：{{ item.result.width || "--" }} × {{ item.result.height || "--" }}</span>
                    <span
                      class="image-result-savings"
                      :class="{ 'is-larger': item.result.outputSize > item.result.originalSize }"
                      >{{ savedPercentLabel(item.result.originalSize, item.result.outputSize) }}</span
                    >
                  </template>
                  <span v-else class="image-format-badge">{{ outputFormat.toUpperCase() }}</span>
                </div>
                <n-progress
                  v-if="item.status === 'processing'"
                  type="line"
                  :percentage="item.progress"
                  :show-indicator="false"
                />
                <small v-if="item.error" role="alert">{{ item.error }}</small>
              </div>
              <div class="image-result-controls">
                <span class="image-result-status" :class="item.status"
                  ><CircleCheck v-if="item.status === 'done'" :size="16" aria-hidden="true" />{{
                    statusName(item.status)
                  }}</span
                >
                <div class="file-actions">
                  <n-button
                    v-if="item.result"
                    text
                    type="primary"
                    size="small"
                    :loading="downloadingItemId === item.id"
                    :disabled="downloading || Boolean(downloadingItemId)"
                    :aria-label="`下载 ${item.file.name} 的压缩结果`"
                    @click="downloadOne(item)"
                  >
                    <template #icon><Download :size="16" aria-hidden="true" /></template>
                    下载
                  </n-button>
                  <n-button
                    text
                    size="small"
                    type="error"
                    :disabled="submitting"
                    :aria-label="`删除 ${item.file.name}`"
                    @click="removeItem(item.id)"
                  >
                    <template #icon><Trash2 :size="15" aria-hidden="true" /></template>
                    删除
                  </n-button>
                </div>
              </div>
            </article>
            <n-empty v-if="!items.length" description="添加图片后，在这里查看压缩进度和结果" />
          </div>
          <footer class="image-compress-downloads">
            <n-button
              type="primary"
              ghost
              :loading="downloading"
              :disabled="!completedItems.length || Boolean(downloadingItemId)"
              @click="downloadAll"
            >
              <template #icon>
                <Download :size="16" aria-hidden="true" />
              </template>
              批量下载
            </n-button>
            <n-button :disabled="!items.length || submitting" @click="clearItems">
              <template #icon>
                <Trash2 :size="16" aria-hidden="true" />
              </template>
              清空
            </n-button>
          </footer>
        </section>
      </section>

      <aside class="side-column">
        <section class="workspace-panel image-compress-settings" aria-label="压缩设置">
          <div class="panel-heading">
            <h3>压缩设置</h3>
          </div>

          <div class="compression-setting-field">
            <h4>压缩预设</h4>
            <div class="preset-tabs" role="group" aria-label="压缩预设">
              <button
                v-for="preset in presets"
                :key="preset.value"
                type="button"
                :class="{ 'is-active': activePreset === preset.value }"
                :aria-pressed="activePreset === preset.value"
                @click="applyPreset(preset.value)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>
          <div class="compression-setting-field">
            <h4>输出格式</h4>
            <div class="compression-format-options" role="group" aria-label="输出格式">
              <button
                v-for="format in formatOptions"
                :key="format.value"
                type="button"
                :class="{ 'is-active': outputFormat === format.value }"
                :aria-pressed="outputFormat === format.value"
                :disabled="submitting"
                @click="outputFormat = format.value"
              >
                {{ format.label }}
              </button>
            </div>
          </div>
          <div class="compression-setting-field compression-quality">
            <div class="compression-setting-label">
              <h4>压缩质量</h4>
              <n-input-number
                :value="quality"
                class="compression-quality-input"
                :min="30"
                :max="95"
                :step="1"
                :precision="0"
                :clearable="false"
                :disabled="submitting"
                :input-props="{ 'aria-label': '压缩质量百分比', inputmode: 'numeric' }"
                @update:value="setQuality"
              >
                <template #suffix>%</template>
              </n-input-number>
            </div>
            <n-slider
              v-model:value="quality"
              v-slider-label="{ label: '压缩质量', text: `${quality}%` }"
              class="compression-quality-slider"
              :min="30"
              :max="95"
              :step="1"
              :disabled="submitting"
            />
          </div>
          <div class="compression-setting-field">
            <h4>宽度限制 <span>（可选）</span></h4>
            <n-input-number
              v-model:value="width"
              clearable
              :min="120"
              :max="6000"
              :disabled="submitting"
              placeholder="不填则保持原宽度"
              :input-props="{ 'aria-label': '宽度限制' }"
            />
          </div>

          <n-button
            class="compression-submit"
            type="primary"
            size="large"
            block
            :loading="submitting"
            :disabled="!pendingItems.length"
            @click="compressAll"
          >
            <template #icon>
              <Play :size="19" fill="currentColor" aria-hidden="true" />
            </template>
            开始压缩
          </n-button>
        </section>
      </aside>
    </div>
  </ToolLayout>
</template>

<script setup lang="ts">
import { formatBytesAdaptive as formatBytes } from "../../shared/utils/format-bytes";
import { computed, onBeforeUnmount, ref } from "vue";
import { NButton, NEmpty, NInputNumber, NProgress, NSlider, useMessage } from "naive-ui";
import { CircleCheck, Download, Play, Trash2, UploadCloud } from "lucide-vue-next";
import { vSliderLabel } from "../../shared/ui/slider-label";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import { imageCompressApi, type ImageToolResponse } from "./api";
import { createImageItemId } from "./image-id";
import { findImageCompressionPreset, imageCompressionPresets, type ImageCompressionPresetValue } from "./presets";

type ImageStatus = "pending" | "processing" | "done" | "failed";
type OutputFormat = ImageToolResponse["outputFormat"];

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: ImageStatus;
  result?: ImageToolResponse;
  error?: string;
};

const message = useMessage();
const items = ref<ImageItem[]>([]);
const fileInput = ref<HTMLInputElement>();
const isDragging = ref(false);
const submitting = ref(false);
const downloading = ref(false);
const downloadingItemId = ref<string | null>(null);
const quality = ref(78);
const width = ref<number | null>(null);
const outputFormat = ref<OutputFormat>("png");
const activePreset = ref<ImageCompressionPresetValue>("balanced");
function setQuality(value: number | null) {
  if (value !== null && Number.isFinite(value)) quality.value = Math.min(95, Math.max(30, Math.round(value)));
}
const presets = imageCompressionPresets;

const formatOptions: Array<{ label: string; value: OutputFormat }> = [
  { label: "JPEG", value: "jpeg" },
  { label: "PNG", value: "png" },
  { label: "WebP", value: "webp" }
];

const pendingItems = computed(() =>
  items.value.filter((item) => item.status === "pending" || item.status === "failed")
);
const completedItems = computed(() => items.value.filter((item) => item.result));
const totalOriginalSize = computed(() => completedItems.value.reduce((sum, item) => sum + item.file.size, 0));
const totalOutputSize = computed(() =>
  completedItems.value.reduce((sum, item) => sum + (item.result?.outputSize ?? 0), 0)
);

function onFileChange(event: Event) {
  // 文件选择器和拖拽入口共用 addFiles，保证格式、数量和预览资源的处理规则一致。
  const target = event.target as HTMLInputElement;
  addFiles(Array.from(target.files ?? []));
  target.value = "";
}

function onDrop(event: DragEvent) {
  isDragging.value = false;
  addFiles(Array.from(event.dataTransfer?.files ?? []));
}

function addFiles(files: File[]) {
  // 先截取本次最多 10 张，再与已有队列合并并保留最近 30 张，超出的预览 URL 立即释放。
  const images = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type)).slice(0, 10);
  if (!images.length) {
    message.warning("请选择 JPG、PNG 或 WebP 图片");
    return;
  }

  const nextItems = [
    ...images.map((file) => ({
      id: createImageItemId(),
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "pending" as ImageStatus
    })),
    ...items.value
  ];
  nextItems.slice(30).forEach((item) => URL.revokeObjectURL(item.previewUrl));
  items.value = nextItems.slice(0, 30);
}

async function compressAll() {
  // 按队列顺序逐张提交，单张失败不会阻断其它图片；完成后根据成功数量给出汇总提示。
  submitting.value = true;
  try {
    const batch = [...pendingItems.value];
    const settings = { quality: quality.value, outputFormat: outputFormat.value, width: width.value };
    let succeeded = 0;
    for (const item of batch) {
      if (!items.value.some((current) => current.id === item.id)) continue;
      if (await compressItem(item, settings)) succeeded += 1;
    }
    if (succeeded === batch.length) message.success(`已完成 ${succeeded} 张图片压缩`);
    else if (succeeded > 0) message.warning(`压缩完成：成功 ${succeeded} 张，失败 ${batch.length - succeeded} 张`);
    else message.error("图片压缩失败，请检查文件后重试");
  } finally {
    submitting.value = false;
  }
}

async function compressItem(
  item: ImageItem,
  settings: { quality: number; outputFormat: OutputFormat; width: number | null }
) {
  // 每张图片独立维护状态和进度，取消请求不展示为业务失败，其他失败项可再次加入 pending 队列。
  item.status = "processing";
  item.progress = 5;
  item.error = undefined;

  const form = new FormData();
  form.append("file", item.file);
  form.append("quality", String(settings.quality));
  form.append("outputFormat", settings.outputFormat);
  if (settings.width) {
    form.append("width", String(settings.width));
  }

  try {
    item.result = await imageCompressApi.upload(form, (event) => {
      if (event.total) {
        item.progress = Math.min(90, Math.round((event.loaded / event.total) * 90));
      }
    });
    item.status = "done";
    item.progress = 100;
    return true;
  } catch (error) {
    if (isApiErrorCancelled(error)) return false;
    item.status = "failed";
    item.progress = 100;
    item.error = formatApiError(error, "压缩失败");
    return false;
  }
}

function applyPreset(value: ImageCompressionPresetValue) {
  const preset = findImageCompressionPreset(value);
  if (!preset) return;
  activePreset.value = value;
  quality.value = preset.quality;
  outputFormat.value = preset.format;
}

function removeItem(id: string) {
  const item = items.value.find((current) => current.id === id);
  if (item) {
    URL.revokeObjectURL(item.previewUrl);
  }
  items.value = items.value.filter((current) => current.id !== id);
}

function clearItems() {
  items.value.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  items.value = [];
}

async function downloadAll() {
  downloading.value = true;
  try {
    // 下载只收集已完成任务的稳定 ID，ZIP Blob URL 在触发浏览器下载后延迟释放。
    const files = completedItems.value.flatMap((item) =>
      item.result
        ? [
            {
              taskId: item.result.task.id,
              fileName: batchOutputName(item.result)
            }
          ]
        : []
    );
    const { blob, contentDisposition } = await imageCompressApi.downloadAll(files);
    triggerDownload(blob, decodeDownloadFileName(contentDisposition) ?? `图片压缩结果-${Date.now()}.zip`);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "批量下载失败"));
  } finally {
    downloading.value = false;
  }
}

async function downloadOne(item: ImageItem) {
  if (!item.result || downloading.value || downloadingItemId.value) return;
  downloadingItemId.value = item.id;
  try {
    const { blob, contentDisposition } = await imageCompressApi.downloadOne(item.result.outputName);
    triggerDownload(blob, decodeDownloadFileName(contentDisposition) ?? batchOutputName(item.result));
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "单张图片下载失败"));
  } finally {
    downloadingItemId.value = null;
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function batchOutputName(result: ImageToolResponse) {
  const baseName = result.originalName.replace(/\.[^.]+$/, "") || "image";
  const extension = result.outputFormat === "jpeg" ? "jpg" : result.outputFormat;
  return `${baseName}.${extension}`;
}

function decodeDownloadFileName(contentDisposition?: string) {
  if (!contentDisposition) return undefined;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="?([^";]+)"?/i.exec(contentDisposition)?.[1];
}

function savedPercentLabel(originalSize: number, outputSize: number) {
  if (!originalSize) return "0%";
  const saved = Math.round((1 - outputSize / originalSize) * 100);
  return saved >= 0 ? `节省 ${saved}%` : `增大 ${Math.abs(saved)}%`;
}

function statusName(status: ImageStatus) {
  const names: Record<ImageStatus, string> = {
    pending: "待压缩",
    processing: "压缩中",
    done: "已完成",
    failed: "失败"
  };
  return names[status];
}

onBeforeUnmount(() => {
  // 页面离开时清理所有本地预览 URL，避免大图队列长期占用浏览器内存。
  items.value.forEach((item) => URL.revokeObjectURL(item.previewUrl));
});
</script>

<style scoped>
.compression-setting-field .compression-quality-input {
  width: 100%;
  min-width: 0;
}
.compression-quality-slider {
  margin-block: 12px;
}
.compression-quality-slider :deep(.n-slider-handle-wrapper)::before {
  position: absolute;
  inset: -13px;
  content: "";
}
.compression-layout :deep(.content.compress-content) {
  grid-template-columns: minmax(0, 1fr);
  padding-inline: 32px;
  gap: 16px;
}
.compression-layout :deep(.tool-page-header) {
  min-height: 72px;
  margin-bottom: 0;
  padding-inline: 0;
  gap: 16px;
}
.compression-layout :deep(.tool-page-icon) {
  width: 64px;
  height: 64px;
  flex-basis: 64px;
}
.compression-layout :deep(.tool-page-header h2) {
  font-size: 26px;
  line-height: 36px;
}
.compression-layout :deep(.tool-page-header p) {
  font-size: 14px;
  line-height: 22px;
}
.image-compress-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 28%);
  align-items: start;
  gap: 20px;
  min-width: 0;
}
.image-compress-main,
.side-column {
  min-width: 0;
}
.image-compress-workspace .image-compress-panel {
  display: flex;
  flex-direction: column;
  min-height: 480px;
  padding: 0;
  overflow: hidden;
}
.image-compress-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  min-height: 104px;
  gap: 0;
  margin: 0;
  border-bottom: 1px solid var(--color-border);
}
.image-compress-summary > div {
  padding: 12px 16px;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-align: center;
}
.image-compress-summary > div + div {
  border-left: 1px solid var(--color-border);
}
.image-compress-summary span {
  font-size: 14px;
}
.image-compress-summary strong {
  font-size: 28px;
  line-height: 38px;
  color: var(--color-text-primary);
}
.image-compress-summary > div:nth-child(2) strong {
  color: var(--color-primary-700);
}
.image-compress-summary > div:nth-child(3) strong {
  color: var(--color-primary-700);
}
.image-compress-summary strong.is-larger,
.image-result-savings.is-larger {
  color: var(--color-error);
}
.image-compress-dropzone:focus-visible,
.preset-tabs button:focus-visible,
.compression-format-options button:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 3px;
}
.image-compress-upload {
  padding: 20px;
}
.image-result-list {
  gap: 12px;
  padding: 0 20px 20px;
}
.image-result-list > :deep(.n-empty) {
  padding: 24px 16px;
  line-height: 1.7;
}
.image-result-row {
  grid-template-columns: 72px minmax(0, 1fr) auto;
  min-height: 100px;
  gap: 16px;
  padding: 12px;
  border-radius: 12px;
  border-color: var(--color-border);
  background: var(--color-surface);
}
.image-thumb {
  width: 72px;
  border: 0;
  border-radius: 9px;
}
.image-result-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.image-result-heading strong {
  min-width: 0;
  flex: 1;
  font-size: 16px;
  line-height: 24px;
}
.image-result-status {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 13px;
}
.image-result-status.done,
.image-result-savings {
  color: color-mix(in srgb, var(--color-success) 70%, var(--color-text));
}
.image-result-status.failed {
  color: var(--color-error);
}
.image-result-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.image-result-details > span {
  display: inline;
  margin: 0;
  line-height: 20px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.image-result-details > .image-format-badge {
  padding: 0 6px;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  border-radius: 5px;
}
.image-result-details > .image-result-savings {
  color: color-mix(in srgb, var(--color-success) 70%, var(--color-text));
}
.image-result-details > .is-larger {
  color: var(--color-error);
}
.image-result-main > :deep(.n-progress) {
  margin-top: 10px;
}
.image-result-main > small {
  margin: 8px 0 0;
}
.image-result-row .file-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  padding-left: 14px;
  border-left: 1px solid var(--color-border);
}
.image-result-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}
.image-result-controls :deep(.n-button) {
  min-height: 32px;
  background: transparent;
  box-shadow: none;
}
.image-compress-downloads {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: auto;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
}
.image-compress-downloads :deep(.n-button) {
  min-width: 112px;
}
.image-compress-workspace .image-compress-settings {
  position: static;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 24px 24px;
  background: var(--color-surface);
}
.image-compress-settings .panel-heading {
  min-height: 64px;
  margin: 0 -24px 20px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
}
.panel-heading h3 {
  font-size: 20px;
  line-height: 28px;
}
.compression-setting-field {
  margin-bottom: 20px;
}
.compression-setting-field h4 {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 22px;
}
.compression-setting-field h4 span {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-secondary);
}
.preset-tabs,
.compression-format-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 0;
  margin: 0;
  background: transparent;
}
.preset-tabs button,
.compression-format-options button {
  min-height: 40px;
  padding: 8px 4px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-surface-subtle);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 14px;
}
.preset-tabs button.is-active,
.compression-format-options button.is-active {
  color: var(--color-primary-700);
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
  font-weight: 600;
}
.compression-format-options button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.preset-tabs button:not(:disabled):hover,
.compression-format-options button:not(:disabled):hover {
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  border-color: var(--color-primary-200);
}
.preset-tabs button:not(:disabled):active,
.compression-format-options button:not(:disabled):active {
  background: var(--color-primary-100);
  border-color: var(--color-primary-600);
}
.compression-setting-label {
  display: grid;
  grid-template-columns: max-content minmax(0, 140px);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.compression-setting-label h4 {
  margin: 0;
  white-space: nowrap;
}
.compression-setting-field :deep(.n-input-number) {
  width: 100%;
}
.compression-submit {
  margin-top: 4px;
  min-height: 44px;
  font-size: 14px;
}
@container tool-content (max-width: 900px) {
  .image-compress-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
}
@container tool-content (max-width: 1100px) {
  .image-result-row {
    grid-template-columns: 72px minmax(0, 1fr);
  }
  .image-thumb {
    width: 72px;
  }
  .image-result-controls {
    grid-column: 2;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  .image-result-row .file-actions {
    border: 0;
    padding: 0;
  }
}
@container tool-content (max-width: 900px) {
  .image-compress-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .image-compress-workspace .image-compress-settings {
    min-height: 0;
  }
  .compression-submit {
    margin-top: 8px;
  }
}
@media (max-width: 560px) {
  .compression-layout :deep(.content.compress-content) {
    padding-inline: 16px;
  }
  .compression-layout :deep(.tool-page-icon) {
    width: 56px;
    height: 56px;
    flex-basis: 56px;
  }
  .compression-layout :deep(.tool-page-header h2) {
    font-size: 24px;
    line-height: 32px;
  }
  .image-compress-workspace .image-compress-panel {
    min-height: 0;
  }
  .image-compress-summary {
    min-height: 90px;
  }
  .image-compress-summary > div {
    padding: 8px 4px;
  }
  .image-compress-summary strong {
    font-size: 20px;
    line-height: 30px;
  }
  .image-compress-summary span {
    font-size: 12px;
  }
  .image-compress-upload {
    padding: 16px;
  }
  .image-result-list {
    padding-inline: 16px;
  }
  .image-result-row {
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 10px;
  }
  .image-thumb {
    width: 56px;
  }
  .image-result-heading {
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }
  .image-result-heading strong {
    flex-basis: 100%;
    font-size: 14px;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .image-compress-downloads {
    padding: 16px;
    padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .image-compress-downloads :deep(.n-button) {
    width: 100%;
    min-width: 0;
  }
  .image-result-controls {
    grid-column: 1 / -1;
    justify-content: space-between;
    gap: 12px;
  }
  .image-result-row .file-actions {
    flex-wrap: wrap;
    gap: 8px;
  }
  .image-compress-workspace .image-compress-settings {
    padding-inline: 16px;
  }
  .image-compress-settings .panel-heading {
    margin-inline: -16px;
    padding-inline: 16px;
  }
  .compression-setting-field :deep(input) {
    font-size: 16px;
  }
  .compression-setting-field :deep(.n-input-number),
  .compression-setting-field :deep(.n-input) {
    --n-height: 44px !important;
  }
}
@media (pointer: coarse), (max-width: 560px) {
  .preset-tabs button,
  .compression-format-options button,
  .image-result-controls :deep(.n-button),
  .image-compress-downloads :deep(.n-button) {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>
