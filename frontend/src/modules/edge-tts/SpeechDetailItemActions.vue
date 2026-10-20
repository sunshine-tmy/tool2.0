<template>
  <div class="detail-item-actions" role="group" aria-label="音频段落操作">
    <SaveToAudioLibrary toolbar :engine="engine" :batch-id="batchId" :items="[item]" />
    <div class="detail-action-group" role="group" aria-label="调整段落顺序">
      <n-button size="small" :disabled="disableMoveUp" @click="emit('move', -1)">
        <template #icon><ArrowUp :size="15" /></template>上移
      </n-button>
      <n-button size="small" :disabled="disableMoveDown" @click="emit('move', 1)">
        <template #icon><ArrowDown :size="15" /></template>下移
      </n-button>
    </div>
    <n-button v-if="item.downloadUrl" tag="a" size="small" :href="resolveBackendUrl(item.downloadUrl)">
      <template #icon><Download :size="15" /></template>下载 MP3
    </n-button>
    <div class="detail-action-group detail-action-group--manage" role="group" aria-label="生成与删除">
      <n-button
        size="small"
        type="primary"
        :loading="regenerating"
        :disabled="disableRegenerate"
        @click="emit('regenerate')"
      >
        <template #icon><RotateCcw :size="15" /></template>重新生成
      </n-button>
      <n-button size="small" type="error" secondary :disabled="disableRemove" @click="emit('remove')">
        <template #icon><Trash2 :size="15" /></template>删除
      </n-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { NButton } from "naive-ui";
import { ArrowDown, ArrowUp, Download, RotateCcw, Trash2 } from "lucide-vue-next";
import { resolveBackendUrl } from "../../config/runtime";
import SaveToAudioLibrary from "../audio-library/SaveToAudioLibrary.vue";

withDefaults(
  defineProps<{
    batchId: string;
    engine?: "chatterbox" | "edge-tts";
    item: { id: string; status: string; attempt?: number; downloadUrl?: string };
    disableMoveUp: boolean;
    disableMoveDown: boolean;
    disableRegenerate: boolean;
    disableRemove: boolean;
    regenerating: boolean;
  }>(),
  { engine: "chatterbox" }
);
const emit = defineEmits<{ move: [delta: -1 | 1]; regenerate: []; remove: [] }>();
</script>
