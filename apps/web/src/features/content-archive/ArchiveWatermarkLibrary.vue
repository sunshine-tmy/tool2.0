<template>
  <section class="watermark-library" aria-label="水印素材库">
    <div class="library-actions">
      <strong>水印库</strong>
      <n-button size="small" :disabled="busy" :aria-expanded="opened" @click="toggle">{{
        opened ? "收起" : "从库中选择"
      }}</n-button>
    </div>
    <template v-if="opened">
      <small>常用 Logo 上传一次，多视频复用；本次直接上传不会自动入库。</small>
      <n-alert v-if="error" type="error">{{ error }}</n-alert>
      <div class="library-actions">
        <n-button size="small" :disabled="busy" :loading="writing" @click="fileInput?.click()">上传入库并使用</n-button>
        <n-button size="small" :disabled="busy" :loading="loading" @click="load">刷新</n-button>
      </div>
      <input
        ref="fileInput"
        type="file"
        hidden
        accept=".png,.jpg,.jpeg,.webp"
        aria-label="上传水印到素材库"
        @change="upload"
      />
      <n-input
        v-model:value="keyword"
        clearable
        placeholder="搜索水印名称"
        aria-label="搜索水印名称"
        :maxlength="120"
      />
      <p v-if="!loading && !filtered.length">{{ items.length ? "没有匹配的水印" : "水印库为空，请上传常用水印" }}</p>
      <div class="library-grid">
        <article v-for="item in visible" :key="item.id">
          <button
            type="button"
            class="library-thumbnail"
            :disabled="busy"
            :aria-label="`使用水印 ${item.name}`"
            @click="select(item.id)"
          >
            <img :src="resolveBackendUrl(item.previewUrl)" :alt="item.name" loading="lazy" />
          </button>
          <span :title="item.name">{{ item.name }}</span>
          <small>{{ item.width }} × {{ item.height }}</small>
          <div class="library-actions">
            <n-button size="tiny" :disabled="busy" @click="select(item.id)">使用</n-button>
            <n-button size="tiny" :disabled="busy" :aria-label="`删除水印 ${item.name}`" @click="remove(item)"
              >删除</n-button
            >
          </div>
        </article>
      </div>
      <n-pagination
        v-if="filtered.length > pageSize"
        v-model:page="page"
        class="pagination-with-total"
        :page-count="pageCount"
        :disabled="busy"
        :page-slot="5"
        ><template #prefix>共 {{ filtered.length }} 条</template></n-pagination
      >
      <small>已存 {{ items.length }}/200 张，长期保留；删库素材不影响已选草稿或已保存视频。</small>
      <p v-if="message" role="status">{{ message }}</p>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NAlert, NButton, NInput, NPagination } from "naive-ui";
import type { ArchiveWatermarkLibraryItem } from "@toolbox/shared/archive";
import { videoEditApi } from "./video-edit-api";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
const props = defineProps<{ disabled: boolean }>();
const emit = defineEmits<{ select: [id: string] }>();
const scope = useRequestScope(),
  confirm = useConfirmDialog();
const opened = ref(false),
  loading = ref(false),
  writing = ref(false),
  loaded = ref(false);
const items = ref<ArchiveWatermarkLibraryItem[]>([]),
  keyword = ref(""),
  page = ref(1);
const error = ref(""),
  message = ref(""),
  fileInput = ref<HTMLInputElement>();
const pageSize = 6;
const busy = computed(() => props.disabled || loading.value || writing.value);
const filtered = computed(() =>
  items.value.filter((item) => item.name.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase()))
);
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));
watch(keyword, () => {
  page.value = 1;
});
watch(pageCount, () => {
  page.value = Math.min(page.value, pageCount.value);
});
let generation = 0;
async function toggle() {
  opened.value = !opened.value;
  if (opened.value && !loaded.value) await load();
}
async function load() {
  if (busy.value) return;
  const version = ++generation;
  loading.value = true;
  error.value = "";
  try {
    const value = await videoEditApi.watermarkLibrary(scope.signal);
    if (scope.aborted || version !== generation) return;
    items.value = value;
    loaded.value = true;
  } catch (e) {
    if (!scope.aborted && version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (!scope.aborted && version === generation) loading.value = false;
  }
}
function select(id: string) {
  if (!busy.value) emit("select", id);
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file || busy.value) return;
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
    error.value = "请选择不超过 20 MiB 的 PNG、JPG 或 WebP 静态图片";
    return;
  }
  writing.value = true;
  error.value = "";
  message.value = "";
  try {
    const saved = await videoEditApi.uploadLibraryWatermark(file, scope.signal);
    if (scope.aborted) return;
    items.value = [saved, ...items.value.filter((entry) => entry.id !== saved.id)];
    keyword.value = "";
    page.value = 1;
    message.value = "已保存到水印库，可跨视频复用；保存视频后水印生效";
    if (!props.disabled) emit("select", saved.id);
  } catch (e) {
    if (!scope.aborted && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (!scope.aborted) writing.value = false;
  }
}
async function remove(item: ArchiveWatermarkLibraryItem) {
  if (busy.value) return;
  writing.value = true;
  error.value = "";
  message.value = "";
  try {
    if (
      !(await confirm(`删除水印「${item.name}」？仅删除库中素材，已选择的草稿和已保存的视频不受影响。`, {
        title: "删除水印素材",
        positiveText: "删除素材"
      })) ||
      scope.aborted ||
      props.disabled
    )
      return;
    await videoEditApi.removeLibraryWatermark(item.id, item.revision, scope.signal);
    if (scope.aborted) return;
    items.value = items.value.filter((entry) => entry.id !== item.id);
    message.value = "已从水印库删除，当前视频保持不变";
  } catch (e) {
    if (!scope.aborted && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (!scope.aborted) writing.value = false;
  }
}
</script>
<style scoped>
.watermark-library {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dbe5f2;
  border-radius: 8px;
  background: #f8fafc;
  min-width: 0;
}
.library-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.library-actions strong {
  margin-right: auto;
}
.library-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.library-grid article {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
}
.library-grid article > span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
}
.library-thumbnail {
  height: 80px;
  padding: 8px;
  cursor: pointer;
  border: 1px solid #dbe5f2;
  border-radius: 6px;
  background: repeating-conic-gradient(#e8edf5 0% 25%, #fff 0% 50%) 0 / 12px 12px;
}
.library-thumbnail:disabled {
  cursor: default;
  opacity: 0.6;
}
.library-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
small,
p {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  line-height: 1.6;
  margin: 0;
}
[role="status"] {
  color: #0f766e;
}
</style>
