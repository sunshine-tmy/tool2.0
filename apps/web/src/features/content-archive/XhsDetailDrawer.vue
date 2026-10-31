<!-- 中文模块说明：小红书归档前端模块，负责列表、详情、媒体和翻译交互 -->
<template>
  <n-modal
    :show="props.open"
    preset="card"
    title="存档详情"
    class="archive-detail-modal"
    :style="{
      width: typeof props.width === 'number' ? `${props.width}px` : props.width,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100dvh - 48px)'
    }"
    :bordered="false"
    :segmented="{ content: true, footer: true }"
    :content-style="{ minHeight: '0', overflowY: 'auto', overflowX: 'hidden' }"
    transform-origin="center"
    aria-label="存档详情"
    @update:show="emit('update:open', $event)"
  >
    <template v-if="props.detail">
      <MediaGallery
        :item="props.detail"
        compact
        @frame-saved="emit('frameSaved', $event)"
        @media-updated="emit('mediaUpdated', $event)"
        @edit-watermark="emit('editWatermark', $event)"
        @edit-audio="emit('editAudio', $event)"
      />
      <div class="detail-meta">
        <ArchiveFacts :item="props.detail" :format-date="props.formatDate" />
        <BilingualContent :item="props.detail" compact @copy="(text, label) => emit('copy', text, label)" />
      </div>
    </template>
    <template #footer>
      <div class="detail-actions">
        <n-button
          v-if="props.detail"
          :type="props.publishedElsewhere ? 'default' : 'primary'"
          secondary
          :loading="props.publicationBusy || props.publicationLoading"
          :disabled="props.publicationBusy || props.publicationLoading"
          :aria-pressed="props.publishedElsewhere === true"
          @click="togglePublication"
        >
          <template #icon><BadgeCheck :size="15" /></template>
          {{ publicationLabel }}
        </n-button>
        <n-button type="error" secondary @click="props.removeItem">
          <template #icon><Trash2 :size="15" /></template>删除存档
        </n-button>
        <n-button v-if="props.detail" secondary @click="props.translateDetail">
          <template #icon><Languages :size="15" /></template>生成英文
        </n-button>
        <n-button
          v-if="props.detail"
          :disabled="!canEditTranslation(props.detail)"
          secondary
          @click="props.editTranslation(props.detail)"
          >编辑英文</n-button
        >
        <n-button
          v-if="props.detail && props.hasEdited(props.detail)"
          secondary
          @click="props.resetTranslation(props.detail)"
        >
          恢复机器翻译
        </n-button>
        <n-button v-if="props.detail" tag="a" :href="props.zipUrl(props.detail.id)" type="primary"
          >下载全部 ZIP</n-button
        >
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NModal } from "naive-ui";
import { computed } from "vue";
import { BadgeCheck, Languages, Trash2 } from "lucide-vue-next";
import type { ContentArchiveItem } from "@toolbox/shared";
import ArchiveFacts from "./ArchiveFacts.vue";
import { canEditTranslation } from "./presentation";
import BilingualContent from "./BilingualContent.vue";
import MediaGallery from "./MediaGallery.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    width: number | string;
    detail?: ContentArchiveItem;
    publishedElsewhere?: boolean;
    publicationBusy?: boolean;
    publicationLoading?: boolean;
    formatDate: (value: string) => string;
    removeItem: () => void | Promise<void>;
    translateDetail: () => void | Promise<void>;
    editTranslation: (item: ContentArchiveItem) => void;
    resetTranslation: (item: ContentArchiveItem) => void | Promise<void>;
    hasEdited: (item: ContentArchiveItem) => boolean;
    zipUrl: (id: string) => string;
  }>(),
  { publishedElsewhere: undefined }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  frameSaved: [item: ContentArchiveItem];
  mediaUpdated: [item: ContentArchiveItem];
  editWatermark: [mediaId: string];
  editAudio: [mediaId: string];
  copy: [text: string, label: string];
  setPublication: [id: string, publishedElsewhere: boolean];
  refreshPublication: [];
}>();
const publicationLabel = computed(() => {
  if (props.publicationLoading) return "读取发布状态";
  if (props.publishedElsewhere === undefined) return "重试发布状态";
  return props.publishedElsewhere ? "取消已发布标记" : "标记为已发布";
});
function togglePublication() {
  if (!props.detail || props.publicationBusy || props.publicationLoading) return;
  if (props.publishedElsewhere === undefined) emit("refreshPublication");
  else emit("setPublication", props.detail.id, !props.publishedElsewhere);
}
</script>

<style scoped>
.detail-meta {
  display: grid;
  gap: 18px;
  margin-top: 20px;
}
.detail-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  width: 100%;
  flex-wrap: wrap;
  justify-content: flex-start;
}
.detail-actions > :last-child {
  margin-left: auto;
}
.archive-detail-modal {
  min-width: 0;
  box-sizing: border-box;
}
@media (max-width: 640px) {
  .detail-actions {
    gap: 8px;
  }
  .detail-actions > :last-child {
    margin-left: 0;
  }
}
</style>
