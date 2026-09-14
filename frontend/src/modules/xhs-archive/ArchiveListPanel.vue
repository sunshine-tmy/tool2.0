<template>
  <section class="workspace-panel archive-panel">
    <div class="archive-toolbar">
      <n-input v-model:value="keyword" clearable placeholder="搜索标题、正文或作者" @keyup.enter="$emit('search')">
        <template #prefix><Search :size="16" /></template>
      </n-input>
      <n-select v-model:value="typeFilter" :options="typeOptions" style="width: 150px" />
      <n-checkbox
        class="archive-select-all"
        :checked="allCurrentArchivesSelected"
        :indeterminate="someCurrentArchivesSelected"
        :disabled="!archives.items.length"
        @update:checked="$emit('toggleSelectAll', $event)"
      >
        全选
      </n-checkbox>
      <n-button secondary :loading="listLoading" @click="$emit('refresh')">
        <template #icon><RefreshCw :size="15" /></template>刷新
      </n-button>
      <n-button type="error" secondary :disabled="!selectedIds.length" @click="$emit('removeSelected')">
        删除所选 {{ selectedIds.length || "" }}
      </n-button>
      <n-button secondary @click="$emit('translateSelected')">
        <template #icon><Languages :size="15" /></template>
        {{ selectedIds.length ? `翻译所选 ${selectedIds.length} 条` : "补全未翻译内容" }}
      </n-button>
    </div>
    <n-spin :show="listLoading">
      <n-empty v-if="!archives.items.length" description="还没有内容存档，请在上方输入链接获取内容" />
      <div v-else class="archive-grid">
        <article
          v-for="archive in archives.items"
          :key="archive.id"
          class="archive-card"
          tabindex="0"
          @click="$emit('openDetail', archive.id)"
          @keyup.enter="$emit('openDetail', archive.id)"
        >
          <n-checkbox
            class="card-selector"
            :checked="selectedIds.includes(archive.id)"
            :aria-label="`选择 ${normalizeXhsText(archive.title)}`"
            @click.stop
            @update:checked="$emit('toggleSelection', archive.id, $event)"
          />
          <div class="card-cover">
            <video
              v-if="archive.coverUrl && isVideoMedia(archive.coverKind)"
              :src="mediaUrl(archive.coverUrl)"
              muted
              playsinline
              preload="metadata"
              @loadedmetadata="showFirstVideoFrame"
            />
            <img
              v-else-if="archive.coverUrl"
              :src="mediaUrl(archive.coverUrl)"
              :alt="normalizeXhsText(archive.title)"
              loading="lazy"
            />
            <div v-else><FileImage :size="30" /></div>
            <span class="card-type-badge" :class="`type-${archive.type}`">
              <FileImage v-if="archive.type === 'image'" :size="13" />
              <Play v-else-if="archive.type === 'video'" :size="13" fill="currentColor" />
              <Sparkles v-else-if="archive.type === 'live-photo'" :size="13" />
              <FileImage v-else :size="13" />
              {{ typeName(archive.type) }}
            </span>
          </div>
          <div class="card-copy">
            <h3>{{ normalizeXhsText(archive.title) }}</h3>
            <p>{{ archive.author?.name || "未知作者" }}</p>
            <div>
              <span>{{ archive.mediaCount }} 个媒体</span><span>{{ formatBytes(archive.totalBytes) }}</span>
              <span>{{ formatDate(archive.updatedAt) }}</span>
            </div>
          </div>
        </article>
      </div>
    </n-spin>
    <n-pagination v-if="archives.total" :page="page" :page-count="archives.pageCount" @update:page="updatePage" />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NCheckbox, NEmpty, NInput, NPagination, NSelect, NSpin } from "naive-ui";
import { FileImage, Languages, Play, RefreshCw, Search, Sparkles } from "lucide-vue-next";
import { normalizeXhsText, type XhsArchiveListResponse } from "@toolbox/shared";
import { resolveBackendUrl } from "../../config/runtime";

const props = defineProps<{
  archives: XhsArchiveListResponse;
  listLoading: boolean;
  selectedIds: string[];
}>();

const emit = defineEmits<{
  search: [];
  refresh: [];
  removeSelected: [];
  translateSelected: [];
  openDetail: [id: string];
  toggleSelection: [id: string, checked: boolean];
  toggleSelectAll: [checked: boolean];
  pageChange: [];
}>();

const keyword = defineModel<string>("keyword", { required: true });
const typeFilter = defineModel<string>("typeFilter", { required: true });
const page = defineModel<number>("page", { required: true });

const typeOptions = [
  { label: "全部类型", value: "all" },
  { label: "图文", value: "image" },
  { label: "视频", value: "video" },
  { label: "Live Photo", value: "live-photo" }
];

const allCurrentArchivesSelected = computed(
  () => props.archives.items.length > 0 && props.archives.items.every((item) => props.selectedIds.includes(item.id))
);
const someCurrentArchivesSelected = computed(
  () => !allCurrentArchivesSelected.value && props.archives.items.some((item) => props.selectedIds.includes(item.id))
);

function updatePage(value: number) {
  page.value = value;
  emit("pageChange");
}

function mediaUrl(url: string) {
  return resolveBackendUrl(url);
}

function isVideoMedia(kind?: string) {
  return kind === "video" || kind === "live-photo";
}

function showFirstVideoFrame(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  if (video.currentTime > 0) return;
  const target = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.1, video.duration / 2) : 0.1;
  video.currentTime = target;
}

function typeName(type: string) {
  return type === "video" ? "视频" : type === "live-photo" ? "Live Photo" : "图文";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
</script>

<style scoped>
.archive-panel {
  padding: 22px;
}
.archive-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.archive-toolbar .n-input {
  flex: 1;
}
.archive-select-all {
  flex: 0 0 auto;
  padding: 8px 10px;
  border: 1px solid #e3e8ef;
  border-radius: 8px;
  background: #f8fafc;
}
.archive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  align-items: start;
  gap: 16px;
}
.archive-card {
  position: relative;
  align-self: start;
  border: 1px solid #e6eaf0;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
  transition: 0.18s ease;
}
.card-selector {
  position: absolute;
  z-index: 2;
  top: 10px;
  left: 10px;
  padding: 5px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.92);
}
.archive-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(34, 55, 90, 0.1);
}
.card-cover {
  position: relative;
  display: grid;
  width: 100%;
  max-height: 460px;
  aspect-ratio: 3/4;
  overflow: hidden;
  place-items: center;
  background: #eef2f7;
}
.card-cover img,
.card-cover video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-cover video {
  pointer-events: none;
}
.card-type-badge {
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 10px;
  display: inline-flex;
  height: 27px;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  background: rgba(51, 65, 85, 0.9);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.24);
  backdrop-filter: blur(8px);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}
.card-type-badge.type-image {
  background: linear-gradient(135deg, rgba(13, 148, 136, 0.96), rgba(15, 118, 110, 0.96));
}
.card-type-badge.type-video {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.96), rgba(190, 24, 93, 0.96));
}
.card-type-badge.type-live-photo {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.96), rgba(37, 99, 235, 0.96));
}
.card-copy {
  padding: 14px;
}
.card-copy h3 {
  margin: 0 0 8px;
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-copy p {
  margin: 0 0 12px;
  color: #687386;
}
.card-copy div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #8a94a6;
  font-size: 12px;
}
.archive-panel .n-pagination {
  justify-content: center;
  margin-top: 20px;
}
@media (max-width: 900px) {
  .archive-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .archive-toolbar {
    flex-wrap: wrap;
  }
  .archive-toolbar .n-input {
    flex-basis: 100%;
  }
  .archive-grid {
    grid-template-columns: 1fr;
  }
  .archive-panel {
    padding: 16px;
  }
}
</style>
