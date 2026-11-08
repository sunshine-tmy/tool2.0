<template>
  <ToolLayout>
    <section class="workbench-home" aria-label="工具首页">
      <div class="workbench-hero">
        <div>
          <h2>让素材工作，更简单。</h2>
          <p>图片、视频、音频与开发工具，一站直达。</p>
          <router-link v-if="lastTool" :to="lastTool.routePath" class="workbench-continue">
            继续上次使用：{{ lastTool.title }}<ArrowRight :size="16" />
          </router-link>
        </div>
        <img :src="hero" class="workbench-hero-art" alt="" draggable="false" fetchpriority="high" />
      </div>
      <div class="workbench-search">
        <Search :size="21" aria-hidden="true" />
        <input
          ref="search"
          v-model="keyword"
          type="search"
          aria-label="搜索工具"
          placeholder="搜索工具名称或用途，例如：提取音频、视频去字幕"
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <nav class="workbench-categories" aria-label="工具分类">
        <button type="button" :aria-pressed="category === ''" @click="category = ''">
          全部工具<span>{{ tools.length }}</span>
        </button>
        <button
          v-for="entry in categories"
          :key="entry.value"
          type="button"
          :aria-pressed="category === entry.value"
          @click="category = entry.value"
        >
          {{ entry.label }}<span>{{ entry.count }}</span>
        </button>
      </nav>
      <div v-if="filtered.length" class="workbench-grid">
        <router-link
          v-for="tool in filtered"
          :key="tool.id"
          class="workbench-card"
          :class="{
            'workbench-card-wide': tool.id === 'lan-transfer' && !category && !keyword.trim()
          }"
          :to="tool.routePath"
        >
          <img
            v-if="tool.icon"
            :src="tool.icon"
            alt=""
            class="workbench-card-icon"
            draggable="false"
            decoding="async"
          />
          <Wrench v-else :size="48" aria-hidden="true" />
          <div class="workbench-card-copy">
            <h3>{{ tool.title }}</h3>
            <p>{{ tool.summary || tool.description }}</p>
            <span class="workbench-category">{{ categoryLabel(tool.category) }}</span>
          </div>
          <ArrowRight class="workbench-card-arrow" :size="18" aria-hidden="true" />
        </router-link>
      </div>
      <div v-else class="workbench-empty" role="status">
        <SearchX :size="30" />
        <h3>没有找到匹配的工具</h3>
        <p>试试其他关键词，或查看全部工具。</p>
        <button type="button" @click="reset">清除筛选</button>
      </div>
      <footer class="workbench-footer">
        <div v-if="localDiagnosticsAvailable">
          <router-link to="/settings"><Layers3 :size="17" />能力管理</router-link>
          <router-link v-if="isDesktop" to="/settings/data-backup"><Database :size="17" />数据备份与恢复</router-link>
          <router-link to="/settings/diagnostics"><Activity :size="17" />启动诊断</router-link>
        </div>
        <span>本地优先 · 无需登录</span>
      </footer>
    </section>
  </ToolLayout>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import type { ToolCategory } from "@toolbox/shared/common";
import { ArrowRight, Search, SearchX, Layers3, Database, Activity, Wrench } from "lucide-vue-next";
import ToolLayout from "../shell/ToolLayout.vue";
import { categoryLabel, toolCategories, toolForPath, workbenchTools } from "../shared/ui/tool/catalog";
import { localDiagnosticsAvailable } from "../shared/http/diagnostics";
import { isEditingText, hasOpenModal } from "../shared/ui/tool/keyboard";
import hero from "../assets/ui-v2/hero-creative-assistant.webp";
const tools = workbenchTools();
const keyword = ref("");
const category = ref<ToolCategory | "">("");
const search = ref<HTMLInputElement>();
const isDesktop = Boolean(window.toolboxDesktop);
const categories = toolCategories
  .map((entry) => ({
    ...entry,
    count: tools.filter((tool) => tool.category === entry.value).length
  }))
  .filter((entry) => entry.count);
const filtered = computed(() => {
  const q = keyword.value.trim().toLocaleLowerCase();
  return tools.filter(
    (tool) =>
      (!category.value || tool.category === category.value) &&
      `${tool.title} ${tool.description} ${tool.summary} ${tool.keywords}`.toLocaleLowerCase().includes(q)
  );
});
const lastTool = ref<ReturnType<typeof toolForPath>>();
function reset() {
  keyword.value = "";
  category.value = "";
}
function focusSearch(event: KeyboardEvent) {
  if (
    event.key !== "/" ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    isEditingText(event.target) ||
    hasOpenModal()
  )
    return;
  event.preventDefault();
  search.value?.focus();
}
onMounted(() => {
  try {
    lastTool.value = toolForPath(localStorage.getItem("toolbox:last-tool") || "");
  } catch {
    /* Storage can be disabled without disabling navigation. */
  }
  window.addEventListener("keydown", focusSearch);
});
onBeforeUnmount(() => window.removeEventListener("keydown", focusSearch));
</script>
