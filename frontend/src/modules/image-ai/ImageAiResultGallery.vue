<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <section v-if="props.task.results.length" class="result-panel image-ai-results">
    <div class="panel-heading">
      <div>
        <h3>处理结果</h3>
        <p>{{ props.task.results.length }} 张图片将在 24 小时后自动清理</p>
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
          <n-button size="small" secondary @click="downloadResult(result.downloadUrl)">
            <template #icon><Download :size="14" /></template>下载
          </n-button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { NButton } from "naive-ui";
import { Download } from "lucide-vue-next";
import type { ImageAiTask } from "@toolbox/shared";
import BeforeAfterCompare from "./BeforeAfterCompare.vue";
import { absoluteImageAiUrl, resultDownloadUrl, triggerImageAiDownload } from "./api";

const props = defineProps<{
  task: ImageAiTask;
  sourceFiles: File[];
  checkerboard?: boolean;
}>();
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
  return Number.isInteger(index) && index >= 0 ? sourceUrls.value[index] : undefined;
}

function downloadAll() {
  triggerImageAiDownload(`/api/v1/tools/image-ai/tasks/${props.task.id}/download.zip`);
}

function downloadResult(downloadUrl: string) {
  triggerImageAiDownload(resultDownloadUrl(downloadUrl));
}
</script>
