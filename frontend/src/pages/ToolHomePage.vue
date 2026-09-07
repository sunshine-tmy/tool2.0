<template>
  <ToolLayout>
    <section class="main-column tool-home">
      <div class="home-overview">
        <div class="home-copy">
          <span class="eyebrow">Ecommerce Toolbox</span>
          <h2>常用素材处理，一屏完成</h2>
          <p>面向电商图片、局域网文件流转和视频文案提取的轻量工作台。</p>
        </div>
        <div class="home-metrics">
          <div>
            <span>可用工具</span>
            <strong>{{ readyTools.length }}</strong>
          </div>
          <div>
            <span>无需登录</span>
            <strong>100%</strong>
          </div>
          <div>
            <span>本地服务</span>
            <strong>3100</strong>
          </div>
        </div>
      </div>

      <div class="section-title">
        <div>
          <h2>工具工作台</h2>
          <p>选择一个模块开始处理，所有工具都按当前项目的本地服务运行。</p>
        </div>
      </div>

      <div class="tool-grid">
        <router-link v-for="tool in tools" :key="tool.id" class="tool-card tool-link" :to="tool.routePath">
          <div class="tool-card-header">
            <div class="tool-icon">
              <component :is="iconByTool[tool.id] ?? Wrench" :size="22" />
            </div>
            <n-tag size="small" :type="tool.status === 'ready' ? 'success' : 'warning'" :bordered="false">
              {{ tool.status === "ready" ? "可用" : "规划中" }}
            </n-tag>
          </div>
          <h3>{{ tool.title }}</h3>
          <p>{{ tool.description }}</p>
          <span class="tool-card-action">打开工具</span>
        </router-link>
      </div>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NTag } from "naive-ui";
import { listTools } from "@toolbox/shared";
import { AudioLines, Clapperboard, FileArchive, FileVideo, ImageDown, ScanLine, Wrench } from "lucide-vue-next";
import ToolLayout from "../layouts/ToolLayout.vue";

const tools = listTools();
const readyTools = computed(() => tools.filter((tool) => tool.status === "ready"));

const iconByTool: Record<string, unknown> = {
  "image-compress": ImageDown,
  "image-ai": ScanLine,
  "lan-transfer": FileArchive,
  "video-text": FileVideo,
  "edge-tts": AudioLines,
  "short-video": Clapperboard
};
</script>
