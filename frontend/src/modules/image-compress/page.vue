<!-- 中文模块说明：图片压缩前端模块，负责上传、压缩参数和结果展示 -->
<template>
  <ToolLayout>
    <section class="main-column image-compress-main">
      <ToolPageHeader
        title="图片压缩"
        description="批量压缩商品图、详情页素材和社媒图片，压缩后保留清晰度与下载记录。"
        kicker="IMAGE OPTIMIZER"
      >
        <template #actions>
          <n-button secondary :loading="downloading" :disabled="!completedItems.length" @click="downloadAll">
            <template #icon>
              <Download :size="16" />
            </template>
            批量下载
          </n-button>
          <n-button secondary :disabled="!items.length || submitting" @click="clearItems">
            <template #icon>
              <Trash2 :size="16" />
            </template>
            清空
          </n-button>
        </template>
      </ToolPageHeader>

      <section class="workspace-panel image-compress-panel">
        <label
          class="dropzone image-compress-dropzone"
          :class="{ 'is-dragging': isDragging }"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" @change="onFileChange" />
          <ImageDown :size="30" />
          <strong>点击或拖拽图片到这里</strong>
          <span>支持 JPG、PNG、WebP，最多一次选择 10 张</span>
        </label>

        <div class="image-compress-summary">
          <div>
            <span>原始体积</span>
            <strong>{{ formatBytes(totalOriginalSize) }}</strong>
          </div>
          <div>
            <span>压缩后</span>
            <strong>{{ completedItems.length ? formatBytes(totalOutputSize) : "--" }}</strong>
          </div>
          <div>
            <span>节省</span>
            <strong>{{ completedItems.length ? savedPercentLabel(totalOriginalSize, totalOutputSize) : "--" }}</strong>
          </div>
        </div>

        <div class="image-result-list">
          <article v-for="item in items" :key="item.id" class="image-result-row">
            <div class="image-thumb">
              <img :src="item.previewUrl" :alt="item.file.name" loading="lazy" decoding="async" />
            </div>
            <div class="image-result-main">
              <strong>{{ item.file.name }}</strong>
              <span>
                {{ formatBytes(item.file.size) }}
                <template v-if="item.result">
                  → {{ formatBytes(item.result.outputSize) }} ·
                  {{ savedPercentLabel(item.result.originalSize, item.result.outputSize) }}
                </template>
              </span>
              <n-progress
                type="line"
                :percentage="item.progress"
                :status="item.status === 'failed' ? 'error' : item.status === 'done' ? 'success' : 'default'"
                indicator-placement="inside"
              />
              <small v-if="item.error">{{ item.error }}</small>
            </div>
            <div class="image-result-meta">
              <span>{{ item.result ? item.result.outputFormat.toUpperCase() : outputFormat.toUpperCase() }}</span>
              <span v-if="item.result">{{ item.result.width || "--" }} × {{ item.result.height || "--" }}</span>
              <span>{{ statusName(item.status) }}</span>
            </div>
            <div class="file-actions">
              <n-button
                v-if="item.result"
                secondary
                size="small"
                tag="a"
                :href="absoluteDownloadUrl(item.result.downloadUrl)"
                target="_blank"
              >
                下载
              </n-button>
              <n-button tertiary size="small" type="error" :disabled="submitting" @click="removeItem(item.id)">
                删除
              </n-button>
            </div>
          </article>
          <n-empty v-if="!items.length" description="暂无图片" />
        </div>
      </section>
    </section>

    <aside class="side-column">
      <section class="workspace-panel image-compress-settings">
        <div class="panel-heading">
          <h3>压缩参数</h3>
          <n-tag size="small" round>{{ quality }}%</n-tag>
        </div>

        <div class="preset-tabs">
          <button
            v-for="preset in presets"
            :key="preset.value"
            type="button"
            :class="{ 'is-active': activePreset === preset.value }"
            @click="applyPreset(preset.value)"
          >
            {{ preset.label }}
          </button>
        </div>

        <n-form label-placement="top">
          <n-form-item label="输出格式">
            <n-select v-model:value="outputFormat" :options="formatOptions" :disabled="submitting" />
          </n-form-item>
          <n-form-item label="图片质量">
            <n-slider v-model:value="quality" :min="30" :max="95" :step="1" :disabled="submitting" />
          </n-form-item>
          <n-form-item label="宽度限制">
            <n-input-number
              v-model:value="width"
              clearable
              :min="120"
              :max="6000"
              :disabled="submitting"
              placeholder="不填则保持原宽度"
            />
          </n-form-item>
        </n-form>

        <n-button type="primary" block :loading="submitting" :disabled="!pendingItems.length" @click="compressAll">
          <template #icon>
            <UploadCloud :size="16" />
          </template>
          开始压缩
        </n-button>
      </section>
    </aside>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  NButton,
  NEmpty,
  NForm,
  NFormItem,
  NInputNumber,
  NProgress,
  NSelect,
  NSlider,
  NTag,
  useMessage
} from "naive-ui";
import { Download, ImageDown, Trash2, UploadCloud } from "lucide-vue-next";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import { resolveBackendUrl } from "../../config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { imageCompressApi, type ImageToolResponse } from "./api";
import { createImageItemId } from "./image-id";

type ImageStatus = "pending" | "processing" | "done" | "failed";
type PresetValue = "balanced" | "clear" | "small";
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
const isDragging = ref(false);
const submitting = ref(false);
const downloading = ref(false);
const quality = ref(78);
const width = ref<number | null>(null);
const outputFormat = ref<OutputFormat>("png");
const activePreset = ref<PresetValue>("balanced");

const presets: Array<{ label: string; value: PresetValue; quality: number; format: OutputFormat }> = [
  { label: "均衡", value: "balanced", quality: 78, format: "png" },
  { label: "高清", value: "clear", quality: 88, format: "webp" },
  { label: "极小", value: "small", quality: 60, format: "webp" }
];

const formatOptions = [
  { label: "WebP", value: "webp" },
  { label: "JPEG", value: "jpeg" },
  { label: "PNG", value: "png" }
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

function applyPreset(value: PresetValue) {
  const preset = presets.find((item) => item.value === value);
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
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = decodeDownloadFileName(contentDisposition) ?? `图片压缩结果-${Date.now()}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "批量下载失败"));
  } finally {
    downloading.value = false;
  }
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

function absoluteDownloadUrl(downloadUrl: string) {
  return resolveBackendUrl(downloadUrl);
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

onBeforeUnmount(() => {
  // 页面离开时清理所有本地预览 URL，避免大图队列长期占用浏览器内存。
  items.value.forEach((item) => URL.revokeObjectURL(item.previewUrl));
});
</script>
