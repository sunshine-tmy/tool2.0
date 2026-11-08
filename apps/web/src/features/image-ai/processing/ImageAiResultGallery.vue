<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <section v-if="props.task.results.length" class="result-panel image-ai-results">
    <div class="panel-heading">
      <div>
        <h3>处理结果</h3>
        <p>{{ props.task.results.length }} 张结果已留档；可在“处理记录”中回看、下载，手动删除前长期保留。</p>
      </div>
      <n-button v-if="props.task.results.length > 1" type="primary" secondary @click="downloadAll">
        <template #icon><Download :size="15" /></template>下载 ZIP
      </n-button>
    </div>
    <div class="result-gallery-grid">
      <article v-for="result in props.task.results" :key="result.id" class="result-gallery-card">
        <BeforeAfterCompare
          v-if="sourceUrlForResult(result.id)"
          :before-url="sourceUrlForResult(result.id) || ''"
          :after-url="absoluteImageAiUrl(result.downloadUrl)"
          :checkerboard="props.checkerboard"
          compact
        />
        <img v-else :src="absoluteImageAiUrl(result.downloadUrl)" :alt="result.outputName" />
        <div class="result-gallery-meta">
          <strong>{{ result.outputName }}</strong>
          <span>{{ result.width }} × {{ result.height }} · {{ result.model }}</span>
        </div>
        <span class="result-completed"><CircleCheck :size="17" />已完成</span>
        <div class="result-gallery-actions">
          <n-button size="small" type="primary" quaternary @click="downloadResult(result.downloadUrl)">
            <template #icon><Download :size="14" /></template>下载
          </n-button>
          <n-button
            v-if="['background_remove', 'product_image'].includes(props.task.operation)"
            size="small"
            type="primary"
            secondary
            @click="emit('edit', props.task.id, result.id)"
            >{{ props.task.operation === "product_image" ? "继续编辑" : "编辑商品图" }}</n-button
          >
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { NButton } from "naive-ui";
import { CircleCheck, Download } from "lucide-vue-next";
import type { ImageAiTask } from "@toolbox/shared";
import BeforeAfterCompare from "./BeforeAfterCompare.vue";
import { absoluteImageAiUrl, resultDownloadUrl, triggerImageAiDownload } from "../media-links";

const props = defineProps<{
  task: ImageAiTask;
  sourceFiles: File[];
  checkerboard?: boolean;
  persistedSources?: boolean;
}>();
const emit = defineEmits<{ edit: [taskId: string, resultId: string] }>();
const sourceUrls = ref<string[]>([]);

function refreshSourceUrls(files: File[]) {
  sourceUrls.value.forEach((url) => URL.revokeObjectURL(url));
  sourceUrls.value = files.map((file) => URL.createObjectURL(file));
}
watch(() => props.sourceFiles, refreshSourceUrls, { immediate: true });
onBeforeUnmount(() => sourceUrls.value.forEach((url) => URL.revokeObjectURL(url)));

function sourceUrlForResult(resultId: string) {
  const rawIndex = resultId.slice(props.task.id.length + 1);
  const index = Number(rawIndex) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= 10) return undefined;
  return props.persistedSources
    ? absoluteImageAiUrl(`/api/v1/tools/image-ai/tasks/${encodeURIComponent(props.task.id)}/inputs/${index + 1}`)
    : sourceUrls.value[index];
}

function downloadAll() {
  triggerImageAiDownload(`/api/v1/tools/image-ai/tasks/${props.task.id}/download.zip`);
}

function downloadResult(downloadUrl: string) {
  triggerImageAiDownload(resultDownloadUrl(downloadUrl));
}
</script>

<style scoped>
.image-ai-results {
  padding: 20px;
  border-color: var(--color-border);
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.panel-heading {
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.panel-heading h3 {
  margin: 0;
  font-size: 18px;
}
.result-gallery-grid {
  gap: 20px;
}
.result-gallery-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-color: var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-subtle);
}
.result-gallery-card > .compare-panel,
.result-gallery-card > img {
  grid-column: 1 / -1;
  width: 100%;
  min-width: 0;
}
.result-gallery-card > img {
  height: clamp(360px, 58vh, 720px);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
.result-gallery-card :deep(.compare-stage.is-compact) {
  height: clamp(360px, 58vh, 720px);
  min-height: 0;
  border-radius: 8px;
}
.result-gallery-card :deep(.compare-slider-row) {
  gap: 12px;
  padding: 8px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.result-gallery-card :deep(.compare-slider-row > span) {
  white-space: nowrap;
}
.result-gallery-card > .compare-panel {
  padding: 0;
  background: transparent;
}
.result-gallery-card :deep(.compare-label) {
  padding: 4px 8px;
  font-size: 12px;
}
.result-gallery-meta {
  min-width: 0;
  gap: 8px;
  padding: 0;
  background: transparent;
}
.result-gallery-meta strong {
  font-size: 14px;
}
.result-gallery-meta span {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.result-completed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-success);
  white-space: nowrap;
  font-size: 13px;
}
.result-gallery-actions {
  display: flex;
  align-items: center;
  justify-content: end;
  flex-wrap: wrap;
  gap: 10px;
}
.result-gallery-actions :deep(.n-button) {
  background: transparent;
  box-shadow: none;
}
@media (max-width: 1100px) {
  .result-gallery-card {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
  }
  .result-gallery-actions {
    grid-column: 1 / -1;
    justify-content: start;
  }
}
@media (max-width: 600px) {
  .image-ai-results {
    padding: 16px;
  }
  .panel-heading {
    flex-wrap: wrap;
  }
  .result-gallery-card {
    gap: 12px;
    padding: 12px;
  }
  .result-gallery-card > img,
  .result-gallery-card :deep(.compare-stage.is-compact) {
    height: clamp(260px, 48vh, 440px);
  }
}
</style>
