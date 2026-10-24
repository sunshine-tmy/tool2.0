<!-- 双平台来源信息：原始作品身份与保存时间分开显示，缺失字段不编造。 -->
<template>
  <div class="drawer-facts">
    <p>
      <span>来源平台</span><strong>{{ archivePlatformLabel(item.platform) }}</strong>
    </p>
    <p>
      <span>作品 ID</span><strong :title="item.contentId">{{ item.contentId }}</strong>
    </p>
    <p>
      <span>作者</span><strong>{{ item.author?.name || "未知" }}</strong>
    </p>
    <p>
      <span>存档时间</span><strong>{{ formatDate(item.updatedAt) }}</strong>
    </p>
    <p v-if="item.publishedAt">
      <span>发布时间</span><strong>{{ formatDate(item.publishedAt) }}</strong>
    </p>
    <a :href="item.canonicalUrl" target="_blank" rel="noopener noreferrer">打开原作品</a>
  </div>
</template>
<script setup lang="ts">
import type { ContentArchiveItem } from "@toolbox/shared";
import { archivePlatformLabel } from "./presentation";
defineProps<{ item: ContentArchiveItem; formatDate: (value: string) => string }>();
</script>
<style scoped>
.drawer-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid #e7ebf1;
  border-radius: 10px;
  background: #f8fafc;
}
p {
  display: grid;
  gap: 3px;
  margin: 0;
}
span {
  color: #8a94a6;
  font-size: 11px;
}
strong {
  overflow: hidden;
  color: #3f495a;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
a {
  align-self: center;
  color: #2563eb;
  font-size: 13px;
}
</style>
