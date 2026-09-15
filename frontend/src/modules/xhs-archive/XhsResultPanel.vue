<template>
  <section class="workspace-panel result-panel">
    <div class="result-head">
      <div>
        <n-tag :bordered="false" type="success">已存档</n-tag>
        <h3>获取结果</h3>
        <p>内容和媒体已保存到本机，可随时预览或下载。</p>
      </div>
      <div class="result-actions">
        <n-button secondary @click="props.copyDescription">
          <template #icon><Copy :size="15" /></template>复制正文
        </n-button>
        <n-button secondary @click="props.copyCurrent('zh')">复制中文</n-button>
        <n-button secondary :disabled="!props.current.translation" @click="props.copyCurrent('en')">复制英文</n-button>
        <n-button secondary @click="props.copyCurrent('both')">复制中英双语</n-button>
        <n-button secondary tag="a" :href="props.current.canonicalUrl" target="_blank">
          <template #icon><ExternalLink :size="15" /></template>原链接
        </n-button>
        <n-button secondary tag="a" :href="props.zipUrl(props.current.id)">
          <template #icon><PackageOpen :size="15" /></template>下载全部 ZIP
        </n-button>
        <n-button secondary :loading="props.refreshing" @click="props.refreshItem(props.current.id)">
          <template #icon><RefreshCw :size="15" /></template>重新获取
        </n-button>
        <n-button secondary @click="props.translateCurrent">
          <template #icon><Languages :size="15" /></template
          >{{ props.current.translation?.status === "ready" ? "重新翻译" : "生成英文" }}
        </n-button>
        <n-button secondary :disabled="!props.current.translation" @click="props.editTranslation(props.current)"
          >编辑英文</n-button
        >
        <n-button v-if="props.hasEdited(props.current)" secondary @click="props.resetTranslation(props.current)"
          >恢复机器翻译</n-button
        >
      </div>
    </div>
    <div class="result-detail-layout">
      <MediaGallery :item="props.current" />
      <div class="drawer-meta result-meta">
        <div class="drawer-facts">
          <p>
            <span>作者</span><strong>{{ props.current.author?.name || "未知" }}</strong>
          </p>
          <p>
            <span>存档时间</span><strong>{{ props.formatDate(props.current.updatedAt) }}</strong>
          </p>
        </div>
        <BilingualContent :item="props.current" />
      </div>
    </div>
    <n-alert v-for="warning in props.current.warnings" :key="warning" type="warning" :bordered="false">{{
      warning
    }}</n-alert>
  </section>
</template>

<script setup lang="ts">
import { NAlert, NButton, NTag } from "naive-ui";
import { Copy, ExternalLink, Languages, PackageOpen, RefreshCw } from "lucide-vue-next";
import type { XhsArchiveItem } from "@toolbox/shared";
import BilingualContent from "./BilingualContent.vue";
import MediaGallery from "./MediaGallery.vue";

const props = defineProps<{
  current: XhsArchiveItem;
  refreshing: boolean;
  copyDescription: () => void | Promise<void>;
  copyCurrent: (language: "zh" | "en" | "both") => void | Promise<void>;
  zipUrl: (id: string) => string;
  refreshItem: (id: string) => void | Promise<void>;
  translateCurrent: () => void | Promise<void>;
  editTranslation: (item: XhsArchiveItem) => void;
  resetTranslation: (item: XhsArchiveItem) => void | Promise<void>;
  hasEdited: (item: XhsArchiveItem) => boolean;
  formatDate: (value: string) => string;
}>();
</script>

<style scoped>
.result-panel {
  padding: 22px;
}
.result-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.result-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 18px;
}
.result-head h3 {
  margin: 8px 0 4px;
  font-size: 22px;
}
.result-head p {
  margin: 0;
  color: #758096;
}
.result-detail-layout {
  display: grid;
  grid-template-columns: minmax(420px, 560px) minmax(320px, 1fr);
  align-items: start;
  gap: 32px;
}
.result-meta {
  margin-top: 0;
  padding: 20px;
  border: 1px solid #e6ebf2;
  border-radius: 14px;
  background: #fbfcfe;
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
@media (max-width: 900px) {
  .result-head {
    flex-direction: column;
  }
  .result-actions {
    flex-wrap: wrap;
  }
}
@media (max-width: 1100px) {
  .result-detail-layout {
    grid-template-columns: 1fr;
  }
  .result-meta {
    width: min(100%, 720px);
    box-sizing: border-box;
    margin: 0 auto;
  }
}
@media (max-width: 640px) {
  .result-panel {
    padding: 16px;
  }
}
</style>
