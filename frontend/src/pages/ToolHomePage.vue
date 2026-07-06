<template>
  <ToolLayout>
    <section class="main-column tool-home">
      <div class="section-title">
        <div>
          <h2>工具工作台</h2>
          <p>按模块维护工具功能，打开对应工具即可开始处理。</p>
        </div>
      </div>

      <div class="tool-grid">
        <router-link
          v-for="tool in filteredTools"
          :key="tool.id"
          class="tool-card tool-link"
          :to="tool.routePath"
        >
          <div class="tool-card-header">
            <div class="tool-icon">
              <component :is="iconByTool[tool.id] ?? Wrench" :size="22" />
            </div>
            <n-tag size="small" :type="tool.status === 'ready' ? 'success' : 'warning'">
              {{ tool.status === "ready" ? "可用" : "规划中" }}
            </n-tag>
          </div>
          <h3>{{ tool.title }}</h3>
          <p>{{ tool.description }}</p>
        </router-link>
      </div>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NTag } from "naive-ui";
import { listTools } from "@toolbox/shared";
import { FileArchive, FileVideo, ImageDown, Repeat, Wrench } from "lucide-vue-next";
import ToolLayout from "../layouts/ToolLayout.vue";

const tools = listTools();
const filteredTools = computed(() => tools);

const iconByTool: Record<string, unknown> = {
  "image-compress": ImageDown,
  "format-convert": Repeat,
  "lan-transfer": FileArchive,
  "video-text": FileVideo
};
</script>
