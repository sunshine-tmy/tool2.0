<template>
  <template v-for="link in links.filter((item) => item.url && (!archiveOnly || item.primary))" :key="link.label">
    <n-button
      v-if="toolbar"
      tag="a"
      size="small"
      :type="link.primary ? 'primary' : 'default'"
      :href="resolveBackendUrl(link.url!)"
    >
      <template #icon><component :is="link.icon" :size="15" /></template>{{ link.label }}
    </n-button>
    <a
      v-else
      :class="compact ? undefined : ['download-button', { primary: link.primary }]"
      :href="resolveBackendUrl(link.url!)"
      :title="link.label"
      :aria-label="link.label"
      ><component :is="link.icon" :size="17" /><template v-if="!compact">{{ link.label }}</template></a
    >
  </template>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { Archive, FileAudio, Captions, Languages } from "lucide-vue-next";
import type { EdgeTtsBatch } from "@toolbox/shared";
import { resolveBackendUrl } from "../../../shared/config/runtime";
const props = defineProps<{
  batch: Pick<
    EdgeTtsBatch,
    "archiveUrl" | "combinedAudioUrl" | "subtitleUrl" | "translationSubtitleUrl" | "bilingualSubtitleUrl"
  >;
  compact?: boolean;
  toolbar?: boolean;
  archiveOnly?: boolean;
}>();
const links = computed(() => [
  { label: "下载全部 ZIP", url: props.batch.archiveUrl, icon: Archive, primary: true },
  { label: "下载总音频", url: props.batch.combinedAudioUrl, icon: FileAudio },
  { label: "下载原文 SRT", url: props.batch.subtitleUrl, icon: Captions },
  { label: "下载中文 SRT", url: props.batch.translationSubtitleUrl, icon: Languages },
  { label: "下载双语 SRT", url: props.batch.bilingualSubtitleUrl, icon: Languages }
]);
</script>
