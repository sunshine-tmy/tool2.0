<!-- 中文模块说明：视频文本前端模块，负责来源、进度、结果、历史和导出 -->
<template>
  <section class="workspace-panel video-text-panel">
    <div class="video-text-grid">
      <div class="video-input-stack">
        <label
          class="dropzone video-dropzone"
          :class="{ 'is-dragging': props.isDragging }"
          @dragenter.prevent="emit('update:isDragging', true)"
          @dragover.prevent="emit('update:isDragging', true)"
          @dragleave.prevent="emit('update:isDragging', false)"
          @drop.prevent="props.onVideoDrop"
        >
          <input hidden type="file" accept="video/mp4,video/webm,video/quicktime" @change="props.onVideoChange" />
          <UploadCloud :size="28" />
          <strong>{{
            props.selectedVideo ? props.selectedVideo.name : props.remoteVideo?.fileName || "点击或拖拽上传视频"
          }}</strong>
          <span>
            {{
              props.remoteVideo
                ? "已从短视频解析带入视频，点击开始解析后将提取文案。"
                : "支持 MP4、WebM、MOV。上传后将调用后端配置的本地语音识别命令生成文案。"
            }}
          </span>
        </label>

        <div v-if="props.videoPreviewUrl" class="video-preview-box">
          <video :src="props.videoPreviewUrl" controls />
        </div>

        <n-button
          type="primary"
          :loading="props.submitting"
          :disabled="!props.selectedVideo && !props.remoteVideo"
          @click="props.submit"
        >
          <template #icon><Wand2 :size="16" /></template>
          开始解析
        </n-button>

        <n-progress
          v-if="props.submitting || props.currentTask"
          type="line"
          :percentage="props.uploadProgress"
          :status="
            props.currentTask?.status === 'failed'
              ? 'error'
              : props.currentTask?.status === 'completed'
                ? 'success'
                : 'default'
          "
          indicator-placement="inside"
        />
      </div>

      <aside class="video-status-panel">
        <h3>解析状态</h3>
        <div class="metric-list">
          <div>
            <span>任务</span><strong>{{ props.currentTask?.id || "未开始" }}</strong>
          </div>
          <div>
            <span>状态</span><strong>{{ props.statusLabel }}</strong>
          </div>
          <div>
            <span>来源</span><strong>{{ props.sourceLabel }}</strong>
          </div>
          <div v-if="props.result">
            <span>字数</span><strong>{{ props.result.stats.characterCount }}</strong>
          </div>
          <div v-for="row in props.recognitionQualityRows" :key="row.label">
            <span>{{ row.label }}</span
            ><strong>{{ row.value }}</strong>
          </div>
        </div>
        <p v-if="props.currentTask?.error" class="status-error">{{ props.currentTask.error }}</p>
        <p v-else class="status-hint">已支持本地识别链路：视频会先提取音频，再调用后端配置的语音识别命令生成文案。</p>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { NButton, NProgress } from "naive-ui";
import { UploadCloud, Wand2 } from "lucide-vue-next";
import type { RemoteVideoSource } from "./remote-source";
import type { VideoTextResult } from "./types";
import type { ToolTask } from "../../types";

const props = defineProps<{
  isDragging: boolean;
  selectedVideo: File | null;
  remoteVideo: RemoteVideoSource | null;
  videoPreviewUrl: string;
  submitting: boolean;
  uploadProgress: number;
  currentTask: ToolTask | null;
  result: VideoTextResult | null;
  statusLabel: string;
  sourceLabel: string;
  recognitionQualityRows: Array<{ label: string; value: string }>;
  onVideoDrop: (event: DragEvent) => void;
  onVideoChange: (event: Event) => void;
  submit: () => void | Promise<void>;
}>();

const emit = defineEmits<{ "update:isDragging": [value: boolean] }>();
</script>
