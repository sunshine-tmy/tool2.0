<template>
  <n-modal
    :show="show"
    preset="card"
    title="导入归档视频"
    class="source-picker"
    style="width: min(920px, calc(100vw - 32px))"
    content-style="display: flex; flex-direction: column; min-height: 0; gap: 12px; overflow-x: hidden"
    :mask-closable="false"
    :closable="!importing"
    :close-on-esc="!importing"
    @update:show="$emit('update:show', $event)"
  >
    <div v-if="!detail" class="picker-filters" role="search" aria-label="筛选归档视频">
      <n-input
        v-model:value="keyword"
        clearable
        placeholder="搜索标题、作者或正文"
        aria-label="归档搜索"
        :disabled="importing"
        @keyup.enter="search"
      />
      <n-select
        v-model:value="platform"
        :options="platforms"
        aria-label="来源平台"
        :disabled="importing"
        @update:value="search"
      />
      <n-cascader
        v-model:value="group"
        :options="groupOptions"
        :check-strategy="'all'"
        filterable
        clearable
        placeholder="全部分组"
        :filter="filterArchiveGroups"
        aria-label="归档分组"
        :disabled="importing"
        @update:value="search"
      />
      <n-select
        v-model:value="sort"
        :options="sorts"
        aria-label="排序方式"
        :disabled="importing"
        @update:value="search"
      />
      <n-button type="primary" :disabled="importing" @click="search">查询</n-button
      ><n-button :disabled="importing" @click="reset">重置</n-button>
    </div>
    <div v-else class="detail-heading">
      <n-button size="small" :disabled="importing" @click="detail = undefined">返回归档列表</n-button
      ><strong>{{ detail.title }}</strong>
    </div>
    <n-alert v-if="error" type="error" closable @close="error = ''">{{ error }}</n-alert>
    <n-spin :show="loading || importing" class="picker-results">
      <div v-if="detail" class="picker-grid">
        <button
          v-for="media in videos"
          :key="media.id"
          class="archive-choice"
          :disabled="importing"
          @click="choose(media)"
        >
          <ArchiveVideoCover :url="mediaUrl(media.previewUrl)" :title="media.fileName" />
          <strong :title="media.audioEdit?.original.fileName || media.fileName">{{
            media.audioEdit?.original.fileName || media.fileName
          }}</strong>
          <span>{{ formatDuration((media.audioEdit?.originalDurationMs ?? media.durationMs ?? 0) / 1000) }}</span>
        </button>
      </div>
      <div v-else-if="items.length" class="picker-grid">
        <button
          v-for="item in items"
          :key="item.id"
          class="archive-choice"
          :disabled="loading || importing"
          @click="pick(item)"
        >
          <ArchiveVideoCover
            :url="item.coverUrl ? mediaUrl(item.coverUrl) : undefined"
            :title="item.title"
            :image="item.coverKind === 'image' || item.coverKind === 'cover'"
          />
          <strong :title="item.title">{{ item.title || "未命名视频" }}</strong>
          <span>{{ platformName(item.platform) }} · {{ new Date(item.fetchedAt).toLocaleDateString("zh-CN") }}</span>
        </button>
      </div>
      <n-empty v-else-if="!loading" description="当前条件下没有视频归档" />
    </n-spin>
    <template #footer
      ><div class="picker-footer">
        <span>{{ detail ? `可选 ${videos.length} 个视频文件` : `共 ${total} 条视频归档` }}</span
        ><n-pagination
          v-if="!detail && total > 20"
          v-model:page="page"
          :page-size="20"
          :item-count="total"
          :disabled="loading || importing"
          @update:page="load"
        /><n-button :disabled="importing" @click="$emit('update:show', false)">关闭</n-button>
      </div></template
    >
  </n-modal>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { NModal, NInput, NSelect, NCascader, NButton, NAlert, NSpin, NEmpty, NPagination } from "naive-ui";
import type {
  ArchiveGroup,
  ArchiveStudioSource,
  ContentArchiveItem,
  ContentArchiveListItem,
  ContentArchiveListQuery,
  ContentArchiveMedia
} from "@toolbox/shared/archive";
import { archiveGroupApi, contentArchiveApi } from "./content-api";
import { archiveGroupTree, filterArchiveGroups } from "./archive-group-tree";
import { videoEditApi } from "./video-edit-api";
import { cutClipId } from "./useArchiveRoughCut";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import ArchiveVideoCover from "./ArchiveVideoCover.vue";
const props = defineProps<{ show: boolean; imported: ArchiveStudioSource[] }>();
const emit = defineEmits<{ "update:show": [boolean]; select: [ArchiveStudioSource] }>();
const keyword = ref(""),
  platform = ref<NonNullable<ContentArchiveListQuery["platform"]>>("all"),
  sort = ref<NonNullable<ContentArchiveListQuery["sort"]>>("archived-desc"),
  group = ref<string | null>(null);
const groups = ref<ArchiveGroup[]>([]),
  items = ref<ContentArchiveListItem[]>([]),
  detail = ref<ContentArchiveItem>();
const page = ref(1),
  total = ref(0),
  loading = ref(false),
  importing = ref(false),
  error = ref("");
let controller: AbortController | undefined, selection: AbortController | undefined;
const platforms = [
  { label: "全部平台", value: "all" },
  { label: "本地上传", value: "local" },
  { label: "TikTok", value: "tiktok" },
  { label: "抖音", value: "douyin" },
  { label: "小红书", value: "xiaohongshu" }
];
const sorts = [
  { label: "最新归档", value: "archived-desc" },
  { label: "最早归档", value: "archived-asc" },
  { label: "最新发布", value: "published-desc" },
  { label: "最早发布", value: "published-asc" }
];
const groupOptions = computed(() => [{ label: "未分组", value: "ungrouped" }, ...archiveGroupTree(groups.value)]);
const videos = computed(() =>
  (detail.value?.media ?? []).filter((media) => media.kind === "video" || media.kind === "live-photo")
);
const mediaUrl = resolveBackendUrl;
const platformName = (value: string) => platforms.find((entry) => entry.value === value)?.label || value;
const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
async function load() {
  controller?.abort();
  const own = (controller = new AbortController());
  loading.value = true;
  error.value = "";
  try {
    const result = await contentArchiveApi.list(
      {
        keyword: keyword.value,
        platform: platform.value,
        sort: sort.value,
        groupId: group.value ?? "all",
        type: "video",
        page: page.value,
        pageSize: 20
      },
      own.signal
    );
    if (!own.signal.aborted) {
      items.value = result.items;
      total.value = result.total;
    }
  } catch (e) {
    if (!isApiErrorCancelled(e) && !own.signal.aborted) error.value = formatApiError(e);
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
  platform.value = "all";
  sort.value = "archived-desc";
  group.value = null;
  search();
}
async function pick(item: ContentArchiveListItem) {
  selection?.abort();
  const own = (selection = new AbortController());
  loading.value = true;
  error.value = "";
  try {
    const value = await contentArchiveApi.detail(item.id, own.signal);
    if (own.signal.aborted) return;
    detail.value = value;
    if (!videos.value.length) error.value = "该归档中没有可导入的视频文件";
    else if (videos.value.length === 1) await choose(videos.value[0]);
  } catch (e) {
    if (!own.signal.aborted && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (!own.signal.aborted) loading.value = false;
  }
}
async function choose(media: ContentArchiveMedia) {
  if (!detail.value || importing.value) return;
  const item = detail.value;
  importing.value = true;
  error.value = "";
  try {
    const info = await videoEditApi.cutSource(item.id, media.id, selection?.signal);
    if (!props.show || selection?.signal.aborted) return;
    const known = props.imported.find(
      (source) => source.itemId === item.id && source.mediaId === media.id && source.checksum === info.checksum
    );
    if (!known && props.imported.length >= 100) throw new Error("最多导入 100 个视频素材");
    emit(
      "select",
      known ?? {
        id: cutClipId(),
        itemId: item.id,
        mediaId: media.id,
        title: item.title.slice(0, 500),
        fileName: info.fileName ?? media.fileName,
        checksum: info.checksum,
        hasAudio: info.hasAudio,
        duration: info.duration,
        width: info.width ?? 1280,
        height: info.height ?? 720,
        fps: info.fps
      }
    );
    emit("update:show", false);
  } catch (e) {
    if (!isApiErrorCancelled(e)) error.value = e instanceof Error ? e.message : formatApiError(e);
  } finally {
    importing.value = false;
  }
}
watch(
  () => props.show,
  (show) => {
    if (show) {
      detail.value = undefined;
      void load();
      void archiveGroupApi
        .list()
        .then((value) => {
          groups.value = value;
        })
        .catch((e) => {
          error.value = formatApiError(e);
        });
    } else {
      controller?.abort();
      selection?.abort();
    }
  }
);
onScopeDispose(() => {
  controller?.abort();
  selection?.abort();
});
</script>
<style scoped>
.source-picker {
  width: min(920px, calc(100vw - 32px));
}
.source-picker :deep(.n-card-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
}
.picker-filters {
  display: grid;
  grid-template-columns: minmax(180px, 1.5fr) repeat(3, minmax(130px, 1fr)) auto auto;
  gap: 8px;
}
.picker-results {
  min-height: 220px;
}
.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.archive-choice {
  display: grid;
  gap: 7px;
  text-align: left;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  min-width: 0;
}
.archive-choice:hover,
.archive-choice:focus-visible {
  border-color: var(--color-primary-600);
  outline-color: var(--color-primary-600);
  background: var(--color-surface-subtle);
}
.archive-choice:disabled {
  opacity: 0.55;
  cursor: default;
}
.archive-choice strong,
.archive-choice span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.archive-choice strong {
  font-size: 13px;
}
.archive-choice span {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.picker-footer,
.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.picker-footer {
  font-size: 12px;
  color: var(--color-text-secondary);
}
@media (max-width: 800px) {
  .picker-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
