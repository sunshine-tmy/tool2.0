<template>
  <n-modal
    :show="show"
    preset="card"
    title="导入音频素材"
    style="width: min(920px, calc(100vw - 32px))"
    content-style="display: flex; flex-direction: column; min-height: 0; gap: 12px"
    :mask-closable="false"
    :closable="!importing"
    :close-on-esc="!importing"
    @update:show="emit('update:show', $event)"
  >
    <div class="audio-filters" role="search" aria-label="筛选音频素材">
      <n-input
        v-model:value="keyword"
        clearable
        placeholder="搜索音频名称、文案或备注"
        aria-label="搜索音频"
        :disabled="importing"
        @keyup.enter="search"
      >
        <template #prefix><Search :size="15" /></template>
      </n-input>
      <n-select
        v-model:value="view"
        :options="views"
        aria-label="音频类型"
        :disabled="importing"
        @update:value="search"
      />
      <AudioGroupSelect
        v-model:value="group"
        :options="groupOptions(groups)"
        root-label="全部分组"
        placeholder="选择音频分组"
        :disabled="importing"
        @update:value="search"
      />
      <n-button type="primary" :loading="loading" :disabled="importing" @click="search">查询</n-button>
      <n-button :disabled="importing" @click="reset">重置</n-button>
    </div>
    <n-alert v-if="error" type="error" closable @close="error = ''">{{ error }}</n-alert>
    <n-spin :show="loading || importing" :description="importing ? '正在导入到草稿…' : undefined">
      <div class="audio-results">
        <article v-for="item in items" :key="item.id" class="audio-choice">
          <n-button
            class="audio-preview"
            :aria-label="`${playingId === item.id ? '暂停' : '试听'} ${item.title}`"
            :title="playingId === item.id ? '暂停试听' : '试听音频'"
            :disabled="!item.available || importing || loading"
            @click="preview(item)"
          >
            <component :is="playingId === item.id ? Pause : Play" :size="20" />
          </n-button>
          <div class="audio-description">
            <strong :title="item.title">{{ item.title }}</strong>
            <span
              >{{ item.purpose === "music" ? "背景音乐" : item.purpose === "speech" ? "配音" : "音频" }} ·
              {{ formatDuration(item.duration) }}</span
            >
            <small v-if="!item.available">文件不可用</small>
          </div>
          <n-button
            :type="isImported(item) ? 'default' : 'primary'"
            :disabled="!item.available || importing || loading || isImported(item)"
            @click="choose(item)"
          >
            {{ isImported(item) ? "已导入" : "添加到素材区" }}
          </n-button>
        </article>
        <n-empty v-if="!items.length && !loading" description="暂无匹配音频，请调整条件或使用本地上传" />
      </div>
    </n-spin>
    <template #footer
      ><div class="audio-picker-footer">
        <span>共 {{ total }} 条音频</span>
        <n-pagination
          v-if="total > 20"
          v-model:page="page"
          :page-size="20"
          :item-count="total"
          :disabled="loading || importing"
          @update:page="load"
        />
        <n-button :disabled="importing" @click="emit('update:show', false)">关闭</n-button>
      </div></template
    >
  </n-modal>
</template>
<script setup lang="ts">
import { onScopeDispose, ref, watch } from "vue";
import { NModal, NInput, NSelect, NButton, NAlert, NSpin, NEmpty, NPagination } from "naive-ui";
import { Search, Play, Pause } from "lucide-vue-next";
import type { AudioLibraryItemView, AudioLibraryGroup, VideoEditorLocalAudio } from "@toolbox/shared";
import AudioGroupSelect from "../audio-library/AudioGroupSelect.vue";
import { groupOptions } from "../audio-library/presentation";
import { archiveEditorAudioApi } from "../audio-library/integrations/music";
import { editorProjectsApi } from "../video-editor/api";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import { resolveBackendUrl } from "../../shared/config/runtime";
const props = defineProps<{ show: boolean; itemId: string; mediaId: string; imported: VideoEditorLocalAudio[] }>();
const emit = defineEmits<{ "update:show": [boolean]; select: [VideoEditorLocalAudio] }>();
const keyword = ref(""),
  view = ref("all"),
  group = ref<string | null>(null),
  page = ref(1),
  total = ref(0);
const items = ref<AudioLibraryItemView[]>([]),
  groups = ref<AudioLibraryGroup[]>([]);
const loading = ref(false),
  importing = ref(false),
  error = ref(""),
  playingId = ref("");
const views = [
  { label: "全部音频", value: "all" },
  { label: "背景音乐", value: "music" },
  { label: "配音素材", value: "speech" }
];
let controller: AbortController | undefined,
  selection: AbortController | undefined,
  player: HTMLAudioElement | undefined;
const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
const isImported = (item: AudioLibraryItemView) =>
  props.imported.some((asset) => asset.source?.id === item.id && asset.source.revision === item.revision);
function stopPreview() {
  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
    player = undefined;
  }
  playingId.value = "";
}
async function preview(item: AudioLibraryItemView) {
  if (playingId.value === item.id) {
    stopPreview();
    return;
  }
  stopPreview();
  const own = (player = new Audio(resolveBackendUrl(item.audioUrl)));
  playingId.value = item.id;
  const failed = () => {
    if (player === own) {
      error.value = "音频试听失败，请重新查询后重试";
      stopPreview();
    }
  };
  own.addEventListener(
    "ended",
    () => {
      if (player === own) stopPreview();
    },
    { once: true }
  );
  own.addEventListener("error", failed, { once: true });
  try {
    await own.play();
  } catch {
    failed();
  }
}
async function load() {
  if (importing.value) return;
  controller?.abort();
  stopPreview();
  const own = (controller = new AbortController());
  loading.value = true;
  error.value = "";
  try {
    const result = await archiveEditorAudioApi.list(
      {
        keyword: keyword.value,
        view: view.value,
        ...(group.value ? { groupId: group.value } : {}),
        page: page.value,
        pageSize: 20
      },
      own.signal
    );
    if (!own.signal.aborted) {
      items.value = result.items;
      groups.value = result.groups;
      total.value = result.total;
    }
  } catch (e) {
    if (!own.signal.aborted && !isApiErrorCancelled(e)) {
      items.value = [];
      total.value = 0;
      error.value = formatApiError(e);
    }
  } finally {
    if (controller === own) loading.value = false;
  }
}
function search() {
  page.value = 1;
  void load();
}
function reset() {
  keyword.value = "";
  view.value = "all";
  group.value = null;
  search();
}
async function choose(item: AudioLibraryItemView) {
  if (loading.value || importing.value || !item.available || isImported(item)) return;
  controller?.abort();
  stopPreview();
  importing.value = true;
  error.value = "";
  const own = (selection = new AbortController()),
    itemId = props.itemId,
    mediaId = props.mediaId;
  try {
    const asset = await editorProjectsApi.importAudio(itemId, mediaId, item.id, item.revision, own.signal);
    if (!own.signal.aborted && props.itemId === itemId && props.mediaId === mediaId) {
      emit("select", asset);
      emit("update:show", false);
    }
  } catch (e) {
    if (!own.signal.aborted && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (selection === own) {
      importing.value = false;
      selection = undefined;
    }
  }
}
watch(
  () => [props.show, props.itemId, props.mediaId] as const,
  ([show]) => {
    controller?.abort();
    selection?.abort();
    stopPreview();
    if (show) {
      page.value = 1;
      void load();
    }
  }
);
onScopeDispose(() => {
  controller?.abort();
  selection?.abort();
  stopPreview();
});
</script>
<style scoped>
.audio-filters {
  display: grid;
  grid-template-columns: minmax(200px, 1.5fr) repeat(2, minmax(145px, 1fr)) auto auto;
  gap: 8px;
}
.audio-results {
  display: grid;
  gap: 12px;
  min-height: 220px;
  max-height: min(440px, 50vh);
  overflow: auto;
  align-content: start;
  padding: 2px;
}
.audio-choice {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}
.audio-preview {
  flex: 0 0 48px;
  height: 48px;
  color: var(--color-primary-600);
  background: var(--color-primary-100);
}
.audio-description {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.audio-description strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
.audio-description span,
.audio-description small,
.audio-picker-footer {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.audio-choice > .n-button {
  flex-shrink: 0;
}
.audio-picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
@media (max-width: 760px) {
  .audio-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .audio-filters > :first-child {
    grid-column: 1 / -1;
  }
}
@media (max-width: 480px) {
  .audio-choice {
    flex-wrap: wrap;
  }
  .audio-choice > .n-button:last-child {
    margin-left: auto;
  }
}
@media (pointer: coarse) {
  .audio-choice > .n-button {
    min-height: 44px;
  }
}
</style>
