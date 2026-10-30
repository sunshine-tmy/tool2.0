<!-- 中文模块说明：小红书归档前端模块，负责列表、详情、媒体和翻译交互 -->
<template>
  <section class="workspace-panel archive-panel">
    <div class="archive-toolbar">
      <n-input v-model:value="keyword" clearable placeholder="搜索标题、正文或作者" @keyup.enter="$emit('search')">
        <template #prefix><Search :size="16" /></template>
      </n-input>
      <n-select v-model:value="typeFilter" :options="typeOptions" style="width: 150px" />
      <n-select
        v-model:value="platformFilter"
        :options="platformOptions"
        aria-label="归档平台筛选"
        style="width: 150px"
      />
      <n-select v-model:value="sort" :options="sortOptions" aria-label="归档列表排序" style="width: 210px" />
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
    <div class="archive-list-heading">
      <p class="filter-scope">
        当前筛选范围 {{ archives.total }} 条；未选择时仅补全此范围内未翻译或已过期内容（每批最多 100 条）。
      </p>
      <div class="archive-view-switch" role="group" aria-label="归档展示方式">
        <n-button
          size="small"
          :type="viewMode === 'card' ? 'primary' : 'default'"
          secondary
          :aria-pressed="viewMode === 'card'"
          @click="setViewMode('card')"
        >
          <template #icon><LayoutGrid :size="15" /></template>卡片
        </n-button>
        <n-button
          size="small"
          :type="viewMode === 'list' ? 'primary' : 'default'"
          secondary
          :aria-pressed="viewMode === 'list'"
          @click="setViewMode('list')"
        >
          <template #icon><List :size="15" /></template>列表
        </n-button>
      </div>
    </div>
    <n-spin :show="listLoading">
      <n-empty v-if="!archives.items.length" description="还没有内容存档，可在上方获取链接内容或批量上传视频" />
      <div v-else class="archive-grid" :class="{ 'is-list': viewMode === 'list' }">
        <article
          v-for="archive in archives.items"
          :key="archive.id"
          class="archive-card"
          tabindex="0"
          @click="$emit('openDetail', archive.id)"
          @keyup.enter.self="$emit('openDetail', archive.id)"
        >
          <n-checkbox
            class="card-selector"
            :checked="selectedIds.includes(archive.id)"
            :aria-label="`选择 ${archiveDisplayTitle(archive)}`"
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
              :alt="archiveDisplayTitle(archive)"
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
            <span v-if="archive.publishedElsewhere" class="card-publication-badge" title="已在其他平台发布">
              <BadgeCheck :size="20" aria-hidden="true" />{{ viewMode === "list" ? "已发布" : "已在其他平台发布" }}
            </span>
          </div>
          <div class="card-copy">
            <span class="card-platform-badge" :class="`platform-${archive.platform}`">{{
              archivePlatformLabel(archive.platform)
            }}</span>
            <h3>{{ archiveDisplayTitle(archive) }}</h3>
            <p>{{ archive.author?.name || "未知作者" }}</p>
            <p v-if="archive.groupId">
              分组：{{ groups?.find((group) => group.id === archive.groupId)?.name || "已分组" }}
            </p>
            <div>
              <span>{{ archive.mediaCount }} 个媒体</span><span>{{ formatBytes(archive.totalBytes) }}</span>
              <span>发布：{{ formatDate(archive.publishedAt) }}</span>
              <span>归档：{{ formatDate(archive.fetchedAt) }}</span>
            </div>
            <div class="card-actions">
              <n-button
                size="small"
                :type="archive.publishedElsewhere ? 'default' : 'primary'"
                secondary
                :loading="publicationBusyIds?.includes(archive.id)"
                :disabled="publicationBusyIds?.includes(archive.id)"
                :aria-pressed="Boolean(archive.publishedElsewhere)"
                @click.stop="$emit('setPublication', archive.id, !archive.publishedElsewhere)"
                @keyup.enter.stop
                >{{ archive.publishedElsewhere ? "取消已发布标记" : "标记为已发布" }}</n-button
              >
            </div>
          </div>
        </article>
      </div>
    </n-spin>
    <n-pagination
      v-if="archives.total"
      class="pagination-with-total"
      :page="page"
      :page-count="archives.pageCount"
      @update:page="updatePage"
    >
      <template #prefix>共 {{ archives.total }} 条</template>
    </n-pagination>
  </section>
</template>

<script setup lang="ts">
import { formatBytesThroughGb as formatBytes } from "../../shared/utils/format-bytes";
import { computed, ref } from "vue";
import { NButton, NCheckbox, NEmpty, NInput, NPagination, NSelect, NSpin } from "naive-ui";
import { BadgeCheck, FileImage, Languages, LayoutGrid, List, Play, RefreshCw, Search, Sparkles } from "lucide-vue-next";
import type { ContentArchiveListResponse, ContentArchiveListQuery, ArchiveGroup } from "@toolbox/shared";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { archiveDisplayTitle, archivePlatformLabel } from "./presentation";
import { formatArchiveDate } from "./format-date";

const props = defineProps<{
  archives: ContentArchiveListResponse;
  listLoading: boolean;
  selectedIds: string[];
  groups?: ArchiveGroup[];
  publicationBusyIds?: string[];
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
  setPublication: [id: string, publishedElsewhere: boolean];
}>();

const keyword = defineModel<string>("keyword", { required: true });
const typeFilter = defineModel<NonNullable<ContentArchiveListQuery["type"]>>("typeFilter", { required: true });
const platformFilter = defineModel<NonNullable<ContentArchiveListQuery["platform"]>>("platformFilter", {
  default: "all"
});
const page = defineModel<number>("page", { required: true });
const sort = defineModel<NonNullable<ContentArchiveListQuery["sort"]>>("sort", { default: "archived-desc" });
const viewModeStorageKey = "toolbox:media-archive:view-mode";
const viewMode = ref(readViewMode());
function readViewMode(): "card" | "list" {
  try {
    return localStorage.getItem(viewModeStorageKey) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}
function setViewMode(mode: "card" | "list") {
  viewMode.value = mode;
  try {
    localStorage.setItem(viewModeStorageKey, mode);
  } catch {
    // 浏览器禁用本地存储时，仍允许在当前页面切换展示方式。
  }
}
const sortOptions = [
  { label: "归档时间：从新到旧", value: "archived-desc" },
  { label: "归档时间：从旧到新", value: "archived-asc" },
  { label: "发布时间：从新到旧", value: "published-desc" },
  { label: "发布时间：从旧到新", value: "published-asc" }
];

const typeOptions = [
  { label: "全部类型", value: "all" },
  { label: "图文", value: "image" },
  { label: "视频", value: "video" },
  { label: "Live Photo", value: "live-photo" }
];
const platformOptions = [
  { label: "全部平台", value: "all" },
  { label: "小红书", value: "xiaohongshu" },
  { label: "抖音", value: "douyin" },
  { label: "TikTok", value: "tiktok" },
  { label: "本地上传", value: "local" }
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

function formatDate(value: string | undefined) {
  return formatArchiveDate(value);
}
</script>

<style scoped>
.archive-panel {
  padding: 22px;
}
.archive-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.filter-scope {
  color: #687386;
  font-size: 12px;
  margin: 0;
}
.archive-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: -8px 0 16px;
}
.archive-view-switch {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.card-platform-badge {
  display: inline-block;
  margin-bottom: 8px;
  padding: 2px 7px;
  border-radius: 5px;
  color: #be123c;
  background: #fff1f2;
  font-size: 11px;
  font-weight: 600;
}
.card-publication-badge {
  position: absolute;
  z-index: 2;
  bottom: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  padding: 10px 8px;
  border: 2px solid #fff;
  border-radius: 8px;
  background: #047857;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 3px 12px #0004;
  pointer-events: none;
}
.card-copy .card-actions {
  margin-top: 12px;
}
.card-platform-badge.platform-douyin {
  color: #7e22ce;
  background: #f3e8ff;
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
.archive-grid.is-list {
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.is-list .archive-card {
  display: grid;
  grid-template-columns: 28px 112px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 14px;
}
.is-list .archive-card:hover {
  transform: none;
}
.is-list .card-selector {
  position: static;
  justify-self: center;
  padding: 0;
  background: transparent;
}
.is-list .card-cover {
  width: 112px;
  height: 132px;
  aspect-ratio: auto;
  border-radius: 8px;
}
.is-list .card-type-badge {
  top: 5px;
  right: 5px;
  height: 23px;
  padding: 0 6px;
  font-size: 11px;
}
.is-list .card-publication-badge {
  bottom: 5px;
  left: 5px;
  right: 5px;
  padding: 5px;
  gap: 4px;
  font-size: 12px;
}
.is-list .card-copy {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 20px;
  row-gap: 6px;
  padding: 0;
  min-width: 0;
}
.is-list .card-copy > :not(.card-actions) {
  grid-column: 1;
}
.is-list .card-platform-badge {
  justify-self: start;
  margin-bottom: 0;
}
.is-list .card-copy h3 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  overflow-wrap: anywhere;
  margin: 0;
}
.is-list .card-copy p {
  margin: 0;
  overflow-wrap: anywhere;
}
.is-list .card-copy .card-actions {
  grid-column: 2;
  grid-row: 1 / span 5;
  align-self: center;
  margin-top: 0;
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
  .is-list .archive-card {
    grid-template-columns: 22px 80px minmax(0, 1fr);
    gap: 8px;
    padding: 10px;
  }
  .is-list .card-cover {
    width: 80px;
    height: 104px;
  }
  .is-list .card-copy {
    grid-template-columns: minmax(0, 1fr);
  }
  .is-list .card-copy .card-actions {
    grid-column: 1;
    grid-row: auto;
    margin-top: 4px;
  }
}
</style>
