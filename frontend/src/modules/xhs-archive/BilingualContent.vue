<!-- 中文模块说明：小红书归档前端模块，负责列表、详情、媒体和翻译交互 -->
<template>
  <div class="bilingual-content" :class="{ compact }">
    <section class="bilingual-title-block">
      <span class="bilingual-label">标题</span>
      <h3>{{ item.title }}</h3>
      <template v-if="item.translation">
        <span class="bilingual-label english-label">English</span>
        <p class="english-title">{{ resolveXhsTranslationField(item.translation.title) || "尚未生成英文翻译" }}</p>
      </template>
    </section>
    <section v-if="body" class="bilingual-body-block">
      <span class="bilingual-label">正文</span>
      <p class="source-body">{{ body }}</p>
      <div v-if="item.translation?.description" class="english-body">
        <span class="bilingual-label english-label">English</span>
        <p>{{ resolveXhsTranslationField(item.translation.description) || "尚未生成英文翻译" }}</p>
      </div>
    </section>
    <section v-if="topics.length" class="bilingual-topics">
      <span class="bilingual-label">话题</span>
      <div v-for="topic in topics" :key="topic.id" class="topic-row">
        <span class="topic-source">#{{ topic.source }}</span>
        <span v-if="translationTopic(topic.id)" class="topic-english">{{
          resolveXhsTranslationField(translationTopic(topic.id))
        }}</span>
      </div>
    </section>
    <span
      class="translation-status"
      :class="item.translation ? `status-${item.translation.status}` : ''"
      aria-live="polite"
    >
      {{ item.translation ? translationLabel(item.translation.status) : "尚未生成英文翻译" }}
    </span>
    <span v-if="item.translation?.error" class="translation-error" role="status">
      {{ item.translation.error.message }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  parseXhsContentText,
  resolveXhsTranslationField,
  type XhsArchiveItem,
  type XhsArchiveTranslation,
  type XhsTranslationField
} from "@toolbox/shared";

const props = defineProps<{ item: XhsArchiveItem; compact?: boolean }>();
const parsed = computed(() => parseXhsContentText(props.item.description));
const body = computed(() => parsed.value.body);
const topics = computed(() => (props.item.topics.length ? props.item.topics : parsed.value.topics));
function translationTopic(id: string): XhsTranslationField | undefined {
  return props.item.translation?.topics.find((topic) => topic.topicId === id);
}
function translationLabel(status: XhsArchiveTranslation["status"]) {
  return status === "ready"
    ? "英文已生成"
    : status === "failed"
      ? "英文翻译失败，可重试"
      : status === "queued"
        ? "等待翻译"
        : status === "installing"
          ? "正在安装翻译环境"
          : status === "stale"
            ? "中文内容已变化"
            : "正在翻译";
}
</script>

<style scoped>
.bilingual-content {
  display: grid;
  min-width: 0;
  gap: 18px;
  color: #29364d;
}
.bilingual-title-block,
.bilingual-body-block,
.bilingual-topics {
  display: grid;
  min-width: 0;
  gap: 8px;
}
.bilingual-label {
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
}
.english-label {
  color: #71809a;
}
h3,
p {
  margin: 0;
  overflow-wrap: anywhere;
}
h3 {
  font-size: 21px;
  line-height: 1.45;
  font-weight: 760;
}
.english-title {
  color: #60708a;
  font-size: 17px;
  line-height: 1.55;
}
.source-body,
.english-body p {
  white-space: pre-wrap;
  line-height: 1.8;
}
.english-body {
  display: grid;
  gap: 7px;
  margin-top: 8px;
  padding: 12px 14px;
  border-left: 3px solid #93c5fd;
  border-radius: 0 10px 10px 0;
  background: #eff6ff;
  color: #3d5a7f;
}
.topic-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}
.topic-source {
  color: #2563eb;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.topic-english {
  color: #6b7a91;
  overflow-wrap: anywhere;
}
.translation-status {
  justify-self: start;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef2f7;
  color: #64748b;
  font-size: 11px;
}
.translation-error {
  color: #c2410c;
  font-size: 12px;
  line-height: 1.5;
}
.status-ready {
  background: #ecfdf5;
  color: #047857;
}
.status-failed {
  background: #fef2f2;
  color: #b91c1c;
}
.compact {
  gap: 14px;
}
.compact h3 {
  font-size: 18px;
}
</style>
