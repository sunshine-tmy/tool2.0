<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <div class="image-ai-stage">
    <label class="dropzone image-ai-dropzone compact">
      <input
        hidden
        multiple
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="props.disabled"
        @change="select"
      />
      <Images :size="30" />
      <strong>{{ props.title }}</strong>
      <span>{{ props.hint }}</span>
    </label>
    <div v-if="previews.length" class="batch-preview-grid">
      <article
        v-for="(item, index) in previews"
        :key="item.url"
        :class="['batch-preview-card', props.checkerboard && 'checkerboard']"
      >
        <img :src="item.url" :alt="item.file.name" />
        <div>
          <strong>{{ item.file.name }}</strong
          ><span>{{ props.formatBytes(item.file.size) }}</span>
        </div>
        <n-button circle size="tiny" tertiary :disabled="props.disabled" @click="remove(index)">
          <template #icon><X :size="14" /></template>
        </n-button>
      </article>
    </div>
    <n-empty v-else description="暂无待处理图片" class="batch-empty" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { NButton, NEmpty } from "naive-ui";
import { Images, X } from "lucide-vue-next";

const props = defineProps<{
  title: string;
  hint: string;
  files: File[];
  disabled: boolean;
  checkerboard?: boolean;
  validateFile: (file: File) => boolean;
  formatBytes: (bytes: number) => string;
}>();
const emit = defineEmits<{ change: [files: File[]] }>();

const previews = computed(() => props.files.map((file) => ({ file, url: URL.createObjectURL(file) })));
watch(previews, (_next, previous) => previous?.forEach((item) => URL.revokeObjectURL(item.url)));
onBeforeUnmount(() => previews.value.forEach((item) => URL.revokeObjectURL(item.url)));

function select(event: Event) {
  const input = event.target as HTMLInputElement;
  const next = Array.from(input.files ?? [])
    .filter(props.validateFile)
    .slice(0, 10);
  input.value = "";
  emit("change", next);
}

function remove(index: number) {
  emit(
    "change",
    props.files.filter((_file, current) => current !== index)
  );
}
</script>
