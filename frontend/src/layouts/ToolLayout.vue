<template>
  <main class="workspace">
    <header class="topbar">
      <router-link class="brand brand-link" to="/">
        <div class="brand-mark">
          <Boxes :size="21" />
        </div>
        <div>
          <h1 class="brand-title">电商工具箱</h1>
          <p class="brand-subtitle">免登录，本地优先的素材处理工作台</p>
        </div>
      </router-link>

      <div class="search-wrap">
        <n-input v-model:value="keyword" clearable aria-label="搜索工具" placeholder="搜索工具、图片、视频、文件">
          <template #prefix>
            <Search :size="16" />
          </template>
        </n-input>
      </div>

      <div class="topbar-status">
        <span class="status-dot" />
        <span>局域网可用</span>
        <strong>{{ readyCount }}/{{ tools.length }}</strong>
      </div>
    </header>

    <section class="shell">
      <aside class="sidebar">
        <div class="sidebar-head">
          <p class="sidebar-section-title">工具模块</p>
          <span>{{ filteredTools.length }}</span>
        </div>
        <div class="category-list">
          <router-link
            v-for="tool in filteredTools"
            :key="tool.id"
            class="category-button category-link"
            :to="tool.routePath"
            :class="{ 'is-active': route.path === tool.routePath }"
          >
            <span class="category-main">
              <component :is="iconByTool[tool.id] ?? Wrench" :size="17" />
              <span>{{ tool.title }}</span>
            </span>
            <n-tag size="small" round :bordered="false" :type="tool.status === 'ready' ? 'success' : 'warning'">
              {{ tool.status === "ready" ? "可用" : "规划" }}
            </n-tag>
          </router-link>
        </div>
      </aside>

      <div class="content">
        <slot />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { NInput, NTag } from "naive-ui";
import { listTools } from "@toolbox/shared";
import {
  AudioLines,
  Boxes,
  ChartNoAxesCombined,
  Clapperboard,
  FileArchive,
  FileVideo,
  ImageDown,
  ScanLine,
  Search,
  Wrench
} from "lucide-vue-next";

const route = useRoute();
const keyword = ref("");
const tools = listTools();
const readyCount = tools.filter((tool) => tool.status === "ready").length;

const iconByTool: Record<string, unknown> = {
  "image-compress": ImageDown,
  "image-ai": ScanLine,
  "lan-transfer": FileArchive,
  "video-text": FileVideo,
  "edge-tts": AudioLines,
  "short-video": Clapperboard,
  "video-insights": ChartNoAxesCombined
};

const filteredTools = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter((tool) => tool.title.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q));
});
</script>
