<template>
  <main
    class="workspace"
    :class="{
      'sidebar-collapsed': !isCompact && desktopSidebarCollapsed,
      'sidebar-drawer-open': isCompact && mobileDrawerOpen
    }"
  >
    <header class="topbar">
      <div class="topbar-leading">
        <n-button
          class="sidebar-toggle"
          circle
          quaternary
          :aria-label="sidebarToggleLabel"
          :aria-expanded="isCompact ? mobileDrawerOpen : !desktopSidebarCollapsed"
          aria-controls="tool-sidebar"
          :title="sidebarToggleLabel"
          @click="toggleSidebar"
        >
          <Menu v-if="isCompact || desktopSidebarCollapsed" :size="20" />
          <PanelLeftClose v-else :size="20" />
        </n-button>
        <router-link class="brand brand-link" to="/">
          <div class="brand-mark">
            <Boxes :size="21" />
          </div>
          <div>
            <h1 class="brand-title">电商工具箱</h1>
            <p class="brand-subtitle">免登录，本地优先的图片与文件工作台</p>
          </div>
        </router-link>
      </div>

      <div class="search-wrap">
        <n-input v-model:value="keyword" clearable aria-label="搜索工具" placeholder="搜索图片、AI、文件传输">
          <template #prefix>
            <Search :size="16" />
          </template>
        </n-input>
      </div>

      <div class="topbar-status">
        <span class="status-dot" />
        <span>本地服务可用</span>
        <strong>{{ readyCount }}/{{ tools.length }}</strong>
      </div>
    </header>

    <section class="shell">
      <aside
        id="tool-sidebar"
        class="sidebar"
        :inert="sidebarHidden || undefined"
        :aria-hidden="sidebarHidden || undefined"
      >
        <div class="sidebar-head">
          <p class="sidebar-section-title">工具模块</p>
          <div class="sidebar-head-actions">
            <span>{{ filteredTools.length }}</span>
            <n-button
              v-if="isCompact"
              circle
              quaternary
              size="small"
              aria-label="关闭工具菜单"
              title="关闭工具菜单"
              @click="mobileDrawerOpen = false"
            >
              <X :size="18" />
            </n-button>
          </div>
        </div>
        <div class="category-list">
          <router-link
            v-for="tool in filteredTools"
            :key="tool.id"
            class="category-button category-link"
            :to="tool.routePath"
            :class="{ 'is-active': route.path === tool.routePath }"
            @click="closeMobileDrawer"
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

      <button
        v-if="isCompact && mobileDrawerOpen"
        type="button"
        class="sidebar-backdrop"
        aria-label="关闭工具菜单"
        @click="mobileDrawerOpen = false"
      />

      <div class="content">
        <slot />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { NButton, NInput, NTag } from "naive-ui";
import { listTools } from "@toolbox/shared";
import {
  AudioLines,
  Boxes,
  ChartNoAxesCombined,
  Clapperboard,
  FileArchive,
  FileVideo,
  ImageDown,
  Menu,
  PanelLeftClose,
  ScanLine,
  Search,
  X,
  Wrench
} from "lucide-vue-next";

const route = useRoute();
const keyword = ref("");
const isCompact = ref(typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
const desktopSidebarCollapsed = ref(false);
const mobileDrawerOpen = ref(false);
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

const sidebarToggleLabel = computed(() => {
  if (isCompact.value) return mobileDrawerOpen.value ? "关闭工具菜单" : "打开工具菜单";
  return desktopSidebarCollapsed.value ? "显示侧边菜单" : "隐藏侧边菜单";
});

const sidebarHidden = computed(() => (isCompact.value ? !mobileDrawerOpen.value : desktopSidebarCollapsed.value));

let compactQuery: MediaQueryList | undefined;

function syncCompactLayout(event?: MediaQueryListEvent) {
  isCompact.value = event?.matches ?? compactQuery?.matches ?? false;
  if (!isCompact.value) mobileDrawerOpen.value = false;
}

function toggleSidebar() {
  if (isCompact.value) mobileDrawerOpen.value = !mobileDrawerOpen.value;
  else desktopSidebarCollapsed.value = !desktopSidebarCollapsed.value;
}

function closeMobileDrawer() {
  if (isCompact.value) mobileDrawerOpen.value = false;
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isCompact.value) mobileDrawerOpen.value = false;
}

onMounted(() => {
  compactQuery = window.matchMedia("(max-width: 900px)");
  syncCompactLayout();
  compactQuery.addEventListener("change", syncCompactLayout);
  window.addEventListener("keydown", onWindowKeydown);
});

onBeforeUnmount(() => {
  compactQuery?.removeEventListener("change", syncCompactLayout);
  window.removeEventListener("keydown", onWindowKeydown);
  document.body.classList.remove("sidebar-drawer-active");
});

watch(
  () => route.path,
  () => closeMobileDrawer()
);

watch(
  () => isCompact.value && mobileDrawerOpen.value,
  (open) => document.body.classList.toggle("sidebar-drawer-active", open)
);
</script>
