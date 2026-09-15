<template>
  <n-drawer
    :show="props.open"
    class="xhs-detail-drawer"
    :width="props.width"
    placement="right"
    @update:show="emit('update:open', $event)"
  >
    <n-drawer-content
      title="存档详情"
      closable
      body-class="xhs-detail-drawer-body"
      body-content-class="xhs-detail-drawer-body-content"
      footer-class="xhs-detail-drawer-footer"
    >
      <template v-if="props.detail">
        <MediaGallery :item="props.detail" compact />
        <div class="drawer-meta">
          <div class="drawer-facts">
            <p>
              <span>作者</span><strong>{{ props.detail.author?.name || "未知" }}</strong>
            </p>
            <p>
              <span>存档时间</span><strong>{{ props.formatDate(props.detail.updatedAt) }}</strong>
            </p>
          </div>
          <BilingualContent :item="props.detail" compact />
        </div>
      </template>
      <template #footer>
        <div class="drawer-actions">
          <n-button type="error" secondary @click="props.removeItem">
            <template #icon><Trash2 :size="15" /></template>删除存档
          </n-button>
          <n-button v-if="props.detail" secondary @click="props.translateDetail">
            <template #icon><Languages :size="15" /></template>生成英文
          </n-button>
          <n-button v-if="props.detail?.translation" secondary @click="props.editTranslation(props.detail)"
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
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { NButton, NDrawer, NDrawerContent } from "naive-ui";
import { Languages, Trash2 } from "lucide-vue-next";
import type { XhsArchiveItem } from "@toolbox/shared";
import BilingualContent from "./BilingualContent.vue";
import MediaGallery from "./MediaGallery.vue";

const props = defineProps<{
  open: boolean;
  width: number | string;
  detail?: XhsArchiveItem;
  formatDate: (value: string) => string;
  removeItem: () => void | Promise<void>;
  translateDetail: () => void | Promise<void>;
  editTranslation: (item: XhsArchiveItem) => void;
  resetTranslation: (item: XhsArchiveItem) => void | Promise<void>;
  hasEdited: (item: XhsArchiveItem) => boolean;
  zipUrl: (id: string) => string;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();
</script>

<style scoped>
.drawer-meta {
  display: grid;
  gap: 18px;
  margin-top: 20px;
}
.drawer-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid #e7ebf1;
  border-radius: 10px;
  background: #f8fafc;
}
.drawer-facts p {
  display: grid;
  gap: 3px;
  margin: 0;
}
.drawer-facts span {
  color: #8a94a6;
  font-size: 11px;
}
.drawer-facts strong {
  overflow: hidden;
  color: #3f495a;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drawer-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  width: 100%;
  flex-wrap: wrap;
  justify-content: flex-start;
}
.drawer-actions > :last-child {
  margin-left: auto;
}
:global(.xhs-detail-drawer),
:global(.xhs-detail-drawer .n-drawer-content),
:global(.xhs-detail-drawer-body),
:global(.xhs-detail-drawer-body-content),
:global(.xhs-detail-drawer-footer) {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
:global(.xhs-detail-drawer-body) {
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-width: none;
}
:global(.xhs-detail-drawer-body::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}
</style>
