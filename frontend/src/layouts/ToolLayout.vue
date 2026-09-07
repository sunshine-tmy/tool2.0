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
            <p class="brand-subtitle">免登录，本地优先的素材处理工作台</p>
          </div>
        </router-link>
      </div>

      <div class="search-wrap">
        <n-input
          ref="searchInput"
          v-model:value="keyword"
          clearable
          aria-label="快捷查找工具"
          placeholder="快捷查找工具"
        >
          <template #prefix>
            <Search :size="16" />
          </template>
          <template #suffix><span class="search-shortcut">/</span></template>
        </n-input>
      </div>

      <button
        type="button"
        class="topbar-status"
        :class="{ 'is-offline': apiState === 'offline', 'is-loading': apiState === 'checking' }"
        aria-label="查看本地服务状态"
        @click="openServiceDrawer"
      >
        <span class="status-dot" />
        <span>{{ apiState === "offline" ? "服务异常" : apiState === "checking" ? "检查中" : "本地服务可用" }}</span>
        <ChevronRight :size="15" />
      </button>
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
          <section v-for="group in filteredToolGroups" :key="group.label" class="sidebar-group">
            <p class="sidebar-group-label">{{ group.label }}</p>
            <router-link
              v-for="tool in group.tools"
              :key="tool.id"
              class="category-button category-link"
              :to="tool.routePath"
              :class="{ 'is-active': route.path === tool.routePath }"
              :title="desktopSidebarCollapsed && !isCompact ? tool.title : undefined"
              @click="closeMobileDrawer"
            >
              <span class="category-main">
                <component :is="iconByTool[tool.id] ?? Wrench" :size="18" />
                <span class="category-title">{{ tool.title }}</span>
              </span>
              <span v-if="tool.status !== 'ready'" class="category-status" aria-label="规划中" />
            </router-link>
          </section>
          <div v-if="!filteredTools.length" class="sidebar-empty">
            <SearchX :size="20" />
            <span>没有匹配的工具</span>
          </div>
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

    <n-drawer v-model:show="serviceDrawerOpen" :width="380" placement="right">
      <n-drawer-content title="本地服务状态" closable>
        <div class="service-summary" :class="{ 'is-offline': apiState === 'offline' }">
          <div class="service-summary-icon">
            <ServerCog :size="22" />
          </div>
          <div>
            <strong>{{
              apiState === "online" ? "主服务运行正常" : apiState === "checking" ? "正在检查服务" : "主服务暂不可用"
            }}</strong>
            <p>
              {{
                apiState === "online" ? "所有基础工具均可通过本机 API 访问。" : "请确认后端服务已启动，然后重新检查。"
              }}
            </p>
          </div>
        </div>
        <div class="service-list">
          <div v-for="tool in tools" :key="tool.id" class="service-row">
            <span class="service-row-icon"><component :is="iconByTool[tool.id] ?? Wrench" :size="17" /></span>
            <div>
              <strong>{{ tool.title }}</strong
              ><small>{{ tool.status === "ready" ? "入口与接口已注册" : "仍在规划" }}</small>
            </div>
            <span class="service-state" :class="{ muted: tool.status !== 'ready' }">
              {{ tool.status === "ready" ? "已启用" : "规划" }}
            </span>
          </div>
        </div>
        <template #footer>
          <div class="service-footer">
            <span>{{ serviceCheckedAt ? `上次检查 ${serviceCheckedAt}` : "尚未完成检查" }}</span>
            <n-button secondary :loading="apiState === 'checking'" @click="loadServiceStatus">
              <template #icon><RefreshCw :size="15" /></template>
              重新检查
            </n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { NButton, NDrawer, NDrawerContent, NInput } from "naive-ui";
import { listTools } from "@toolbox/shared";
import {
  AudioLines,
  Boxes,
  ChevronRight,
  Clapperboard,
  FileArchive,
  FileVideo,
  ImageDown,
  Menu,
  PanelLeftClose,
  RefreshCw,
  ScanLine,
  Search,
  SearchX,
  ServerCog,
  X,
  Wrench
} from "lucide-vue-next";
import { httpClient } from "../services/http";

const route = useRoute();
const keyword = ref("");
const searchInput = ref<{ focus: () => void }>();
const isCompact = ref(typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
const desktopSidebarCollapsed = ref(false);
const mobileDrawerOpen = ref(false);
const serviceDrawerOpen = ref(false);
const apiState = ref<"checking" | "online" | "offline">("checking");
const serviceCheckedAt = ref("");
const tools = listTools();

const iconByTool: Record<string, unknown> = {
  "image-compress": ImageDown,
  "image-ai": ScanLine,
  "lan-transfer": FileArchive,
  "video-text": FileVideo,
  "edge-tts": AudioLines,
  "short-video": Clapperboard
};

const filteredTools = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter((tool) => tool.title.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q));
});

const toolGroupDefinitions = [
  { label: "图片工具", ids: ["image-compress", "image-ai"] },
  { label: "视频与文案", ids: ["video-text", "edge-tts", "short-video"] },
  { label: "文件协作", ids: ["lan-transfer"] }
];

const filteredToolGroups = computed(() =>
  toolGroupDefinitions
    .map((group) => ({ ...group, tools: filteredTools.value.filter((tool) => group.ids.includes(tool.id)) }))
    .filter((group) => group.tools.length)
);

const sidebarToggleLabel = computed(() => {
  if (isCompact.value) return mobileDrawerOpen.value ? "关闭工具菜单" : "打开工具菜单";
  return desktopSidebarCollapsed.value ? "显示侧边菜单" : "隐藏侧边菜单";
});

const sidebarHidden = computed(() => isCompact.value && !mobileDrawerOpen.value);

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

function openServiceDrawer() {
  serviceDrawerOpen.value = true;
  void loadServiceStatus();
}

async function loadServiceStatus() {
  apiState.value = "checking";
  try {
    await httpClient.get<{ status: string }>("/health");
    apiState.value = "online";
  } catch {
    apiState.value = "offline";
  } finally {
    serviceCheckedAt.value = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
  }
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isCompact.value) mobileDrawerOpen.value = false;
  if (event.key === "/" && !isEditableTarget(event.target)) {
    event.preventDefault();
    searchInput.value?.focus();
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, [contenteditable='true']");
}

onMounted(() => {
  compactQuery = window.matchMedia("(max-width: 900px)");
  syncCompactLayout();
  compactQuery.addEventListener("change", syncCompactLayout);
  window.addEventListener("keydown", onWindowKeydown);
  void loadServiceStatus();
});

onBeforeUnmount(() => {
  compactQuery?.removeEventListener("change", syncCompactLayout);
  window.removeEventListener("keydown", onWindowKeydown);
  document.body.classList.remove("sidebar-drawer-active");
});

watch(
  () => route.path,
  (path) => {
    closeMobileDrawer();
    if (path.startsWith("/tools/")) localStorage.setItem("toolbox:last-tool", path);
  }
);

watch(
  () => isCompact.value && mobileDrawerOpen.value,
  (open) => document.body.classList.toggle("sidebar-drawer-active", open)
);
</script>
