<template>
  <ToolLayout>
    <section class="main-column tool-home">
      <div class="home-overview">
        <div class="home-copy">
          <span class="eyebrow">本地优先 · 无需登录</span>
          <h2>今天要处理什么？</h2>
          <p>从图片、视频、配音到局域网文件流转，选择一个工具即可开始。</p>
          <div class="home-quick-actions">
            <router-link to="/tools/image-compress"><ImageDown :size="16" />压缩图片</router-link>
            <router-link to="/tools/lan-transfer"><FileArchive :size="16" />传输文件</router-link>
            <router-link to="/tools/edge-tts"><AudioLines :size="16" />生成配音</router-link>
          </div>
        </div>
        <div class="home-focus-card">
          <span class="home-focus-icon"><ShieldCheck :size="21" /></span>
          <div>
            <strong>素材优先保留在本机</strong>
            <p>基础模块通过本地服务处理，敏感素材无需先上传到第三方工作台。</p>
          </div>
          <router-link v-if="lastTool" :to="lastTool.routePath" class="home-continue">
            <Clock3 :size="15" />继续使用 {{ lastTool.title }}<ArrowRight :size="15" />
          </router-link>
        </div>
      </div>

      <div class="section-title">
        <div>
          <h2>工具工作台</h2>
          <p>{{ readyTools.length }} 个工具已就绪，选择任务即可开始。</p>
        </div>
      </div>

      <div class="tool-grid">
        <router-link v-for="tool in tools" :key="tool.id" class="tool-card tool-link" :to="tool.routePath">
          <div class="tool-card-header">
            <div class="tool-icon">
              <component :is="iconByTool[tool.id] ?? Wrench" :size="22" />
            </div>
            <span class="tool-category">{{ categoryLabel(tool.category) }}</span>
          </div>
          <h3>{{ tool.title }}</h3>
          <p>{{ tool.description }}</p>
          <span class="tool-card-action">开始使用 <ArrowRight :size="15" /></span>
        </router-link>
      </div>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { listTools } from "@toolbox/shared";
import {
  ArrowRight,
  AudioLines,
  Clapperboard,
  Clock3,
  FileArchive,
  FileVideo,
  ImageDown,
  ScanLine,
  ShieldCheck,
  Wrench
} from "lucide-vue-next";
import ToolLayout from "../layouts/ToolLayout.vue";

const tools = listTools();
const readyTools = computed(() => tools.filter((tool) => tool.status === "ready"));
const lastTool = computed(() => {
  const path = typeof window === "undefined" ? "" : localStorage.getItem("toolbox:last-tool");
  return tools.find((tool) => tool.routePath === path);
});

const iconByTool: Record<string, unknown> = {
  "image-compress": ImageDown,
  "image-ai": ScanLine,
  "lan-transfer": FileArchive,
  "video-text": FileVideo,
  "edge-tts": AudioLines,
  "short-video": Clapperboard
};

function categoryLabel(category: (typeof tools)[number]["category"]) {
  if (category === "image") return "图片";
  if (category === "video") return "视频";
  if (category === "audio") return "音频";
  if (category === "file") return "文件";
  return "工具";
}
</script>
