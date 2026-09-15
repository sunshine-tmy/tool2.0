<!-- 中文模块说明：视频文本前端模块，负责来源、进度、结果、历史和导出 -->
<template>
  <section v-if="props.result" class="workspace-panel result-panel">
    <div class="panel-heading">
      <h3>提取结果</h3>
      <div class="result-actions">
        <n-button secondary size="small" @click="props.copyFullText">复制全文</n-button>
        <n-button secondary size="small" tag="a" :href="props.exportUrl('txt')" target="_blank">TXT</n-button>
        <n-button secondary size="small" tag="a" :href="props.exportUrl('srt')" target="_blank">SRT</n-button>
        <n-button secondary size="small" tag="a" :href="props.exportUrl('json')" target="_blank">JSON</n-button>
      </div>
    </div>

    <div class="analysis-grid">
      <div class="analysis-section transcript-section">
        <h4>完整文案</h4>
        <pre>{{ props.result.fullText }}</pre>
      </div>
      <div class="analysis-section">
        <h4>摘要</h4>
        <ul>
          <li v-for="item in props.result.summary" :key="item">{{ item }}</li>
        </ul>
      </div>
    </div>

    <div class="timeline-list">
      <h4>时间轴文案</h4>
      <article v-for="segment in props.result.segments" :key="`${segment.index}-${segment.text}`" class="timeline-row">
        <span>{{ props.formatSeconds(segment.startSeconds) }} - {{ props.formatSeconds(segment.endSeconds) }}</span>
        <strong>{{ segment.text }}</strong>
      </article>
    </div>

    <div v-if="props.lowConfidenceSegments.length" class="timeline-list">
      <h4>建议复核片段</h4>
      <article
        v-for="segment in props.lowConfidenceSegments"
        :key="`${segment.index}-${segment.text}`"
        class="timeline-row"
      >
        <span>{{ props.formatSeconds(segment.startSeconds) }} - {{ props.formatSeconds(segment.endSeconds) }}</span>
        <strong>{{ segment.text }}</strong>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { NButton } from "naive-ui";
import type { VideoTextResult } from "./types";

const props = defineProps<{
  result: VideoTextResult | null;
  lowConfidenceSegments: NonNullable<NonNullable<VideoTextResult["recognitionQuality"]>["lowConfidenceSegments"]>;
  copyFullText: () => void | Promise<void>;
  exportUrl: (format: "txt" | "srt" | "json") => string;
  formatSeconds: (seconds?: number) => string;
}>();
</script>
