<template>
  <main class="workspace">
    <header class="topbar">
      <router-link class="brand brand-link" to="/">
        <div class="brand-mark">
          <Boxes :size="21" />
        </div>
        <div>
          <h1 class="brand-title">电商工具箱</h1>
          <p class="brand-subtitle">免登录，打开即可处理素材</p>
        </div>
      </router-link>

      <div class="search-wrap">
        <n-input v-model:value="keyword" clearable placeholder="搜索工具，例如 图片、视频、文件">
          <template #prefix>
            <Search :size="16" />
          </template>
        </n-input>
      </div>

      <n-tag round :bordered="false" type="success">局域网可用</n-tag>
    </header>

    <section class="shell">
      <aside class="sidebar">
        <p class="sidebar-section-title">工具模块</p>
        <div class="category-list">
          <router-link
            v-for="tool in filteredTools"
            :key="tool.id"
            class="category-button category-link"
            :to="tool.routePath"
            :class="{ 'is-active': route.path === tool.routePath }"
          >
            <span>{{ tool.title }}</span>
            <n-tag size="small" round>{{ tool.status === "ready" ? "可用" : "规划" }}</n-tag>
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
import { Boxes, Search } from "lucide-vue-next";

const route = useRoute();
const keyword = ref("");
const tools = listTools();

const filteredTools = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter((tool) => tool.title.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q));
});
</script>
