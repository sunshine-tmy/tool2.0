<template>
  <ToolLayout
    ><section class="edge-tts-page">
      <ToolPageHeader
        title="多国语言配音"
        description="在线自然音色和参考音色克隆均支持有序双语文案、批次生成和直播音频归档。"
        kicker="MULTILINGUAL SPEECH"
      >
        <template #actions
          ><n-tag v-if="engine === 'edge'" :type="health?.available ? 'success' : 'info'" round
            >Edge-TTS {{ health?.version || "在线配音" }}</n-tag
          ><n-tag v-else type="info" round>Chatterbox Multilingual V3</n-tag></template
        >
      </ToolPageHeader>
      <div v-if="engine === 'edge'" class="edge-tts-privacy">
        <Cloud :size="18" /><span
          >此功能需要联网，外语文案会发送到微软在线语音服务；中文译文仅用于本地字幕与归档，生成文件默认保留 3 天。</span
        >
      </div>
      <div class="edge-tts-engine-tabs" role="tablist" aria-label="配音引擎">
        <button
          type="button"
          :class="{ active: engine === 'chatterbox' }"
          role="tab"
          :aria-selected="engine === 'chatterbox'"
          @click="engine = 'chatterbox'"
        >
          <Mic2 :size="18" /><span
            ><strong>参考音色克隆</strong><small>Chatterbox V3 · 按设备可用性选择 CPU / GPU</small></span
          >
        </button>
        <button
          type="button"
          :class="{ active: engine === 'edge' }"
          role="tab"
          :aria-selected="engine === 'edge'"
          @click="engine = 'edge'"
        >
          <Cloud :size="18" /><span><strong>在线自然音色</strong><small>Edge-TTS · 免参考音频</small></span>
        </button>
      </div>
      <KeepAlive>
        <EdgeTtsPanel v-if="engine === 'edge'" @health="health = $event" />
        <ChatterboxPanel v-else />
      </KeepAlive></section
  ></ToolLayout>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { NTag } from "naive-ui";
import { Mic2, Cloud } from "lucide-vue-next";
import type { EdgeTtsHealth } from "@toolbox/shared";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import ChatterboxPanel from "./chatterbox/ChatterboxPanel.vue";
import EdgeTtsPanel from "./edge-tts/EdgeTtsPanel.vue";
const engine = ref<"edge" | "chatterbox">("chatterbox");
const health = ref<EdgeTtsHealth>();
</script>
