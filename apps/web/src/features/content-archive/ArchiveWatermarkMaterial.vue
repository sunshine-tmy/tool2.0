<template>
  <section class="watermark-material" aria-label="水印素材">
    <n-button
      type="primary"
      class="upload-action"
      :disabled="disabled || uploading"
      :loading="uploading"
      @click="fileInput?.click()"
      ><template #icon><Upload :size="18" /></template>上传水印并添加到轨道</n-button
    >
    <p class="hint">PNG / JPG / WebP · 最大 20 MiB · 推荐透明 PNG</p>
    <input ref="fileInput" hidden type="file" accept=".png,.jpg,.jpeg,.webp" @change="choose" />
    <n-alert v-if="error" type="error">{{ error }}</n-alert>
    <ArchiveWatermarkLibrary :disabled="disabled || uploading" @select="fromLibrary" />
  </section>
</template>
<script setup lang="ts">
import { Upload } from "lucide-vue-next";
import { ref, onScopeDispose } from "vue";
import { NButton, NAlert } from "naive-ui";
import type { ArchiveWatermarkDraft } from "@toolbox/shared/archive";
import ArchiveWatermarkLibrary from "./ArchiveWatermarkLibrary.vue";
import { videoEditApi } from "./video-edit-api";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
const props = defineProps<{ itemId: string; mediaId: string; disabled: boolean }>();
const emit = defineEmits<{ add: [ArchiveWatermarkDraft, string] }>();
const fileInput = ref<HTMLInputElement>(),
  uploading = ref(false),
  error = ref("");
const scope = new AbortController();
onScopeDispose(() => scope.abort());
async function add(request: () => Promise<ArchiveWatermarkDraft>, title: string) {
  if (uploading.value || props.disabled) return;
  const media = props.mediaId,
    item = props.itemId;
  uploading.value = true;
  error.value = "";
  try {
    const asset = await request();
    if (!scope.signal.aborted && media === props.mediaId && item === props.itemId) emit("add", asset, title);
  } catch (e) {
    if (!isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    uploading.value = false;
  }
}
function choose(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (file) void add(() => videoEditApi.uploadWatermark(props.itemId, props.mediaId, file, scope.signal), file.name);
}
function fromLibrary(id: string) {
  void add(() => videoEditApi.selectLibraryWatermark(props.itemId, props.mediaId, id, scope.signal), "水印素材");
}
</script>
<style scoped>
.watermark-material {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.upload-action {
  width: 100%;
  min-height: 44px;
}
.hint {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}
</style>
