<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
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
            <img class="brand-icon" src="/ecommerce-toolbox-icon-32.png" alt="" draggable="false" />
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

      <n-button quaternary circle aria-label="桌面设置" title="桌面设置" @click="$router.push('/settings')">
        <Settings :size="19" />
      </n-button>

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
        <n-alert v-if="desktopCapabilityHint" type="info" :bordered="false" class="desktop-capability-hint">
          <div class="desktop-capability-hint-content">
            <div>
              <strong>{{ desktopCapabilityHint.title }}：{{ desktopCapabilityHint.heading }}</strong>
              <p>{{ desktopCapabilityHint.message }}</p>
            </div>
            <n-button
              v-if="desktopCapabilityHint.actionVisible"
              size="small"
              secondary
              @click="$router.push('/settings')"
              >{{ desktopCapabilityHint.actionLabel }}</n-button
            >
          </div>
        </n-alert>
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
        <section v-if="deploymentMode === 'lan'" class="admin-session-section">
          <div class="admin-session-heading">
            <div>
              <strong>局域网管理员</strong>
              <small>{{
                adminAuthenticated ? "当前浏览器已获得管理写权限" : "删除、AI、翻译和配置操作需要管理员 PIN"
              }}</small>
            </div>
            <n-button v-if="adminAuthenticated" text size="small" :loading="adminLoading" @click="logoutAdmin">
              退出
            </n-button>
          </div>
          <div v-if="!adminAuthenticated" class="admin-session-form">
            <n-input
              v-model:value="adminPin"
              type="password"
              show-password-on="mousedown"
              autocomplete="current-password"
              placeholder="输入 ADMIN_PIN"
              :disabled="adminLoading"
              @keyup.enter="loginAdmin"
            />
            <n-button type="primary" :loading="adminLoading" :disabled="adminPin.length < 4" @click="loginAdmin">
              解锁管理操作
            </n-button>
          </div>
          <n-alert v-if="adminError" type="error" :bordered="false">{{ adminError }}</n-alert>
        </section>
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
        <section class="cleanup-section">
          <div class="cleanup-heading">
            <div><strong>存储与清理</strong><small>只清理所选运行数据，依赖、模型和配置始终保留</small></div>
            <n-button text size="small" :loading="cleanupLoading" @click="loadCleanup">重新统计</n-button>
          </div>
          <n-alert v-if="cleanupError" type="error" :bordered="false">{{ cleanupError }}</n-alert>
          <n-checkbox-group v-model:value="selectedCleanupIds" class="cleanup-list">
            <n-checkbox v-for="category in cleanupCategories" :key="category.id" :value="category.id">
              <span class="cleanup-option"
                ><span
                  >{{ category.label }}<em v-if="category.risk === 'high'">高风险</em
                  ><em v-else-if="category.requiresStop" class="stop-hint">建议停服</em></span
                ><small>{{ formatBytes(category.bytes) }} · {{ category.files }} 个文件</small></span
              >
            </n-checkbox>
          </n-checkbox-group>
          <div class="cleanup-total">
            <span>预计释放</span><strong>{{ formatBytes(cleanupSelectedBytes) }}</strong>
          </div>
          <n-button
            block
            type="primary"
            secondary
            :loading="cleanupExecuting"
            :disabled="!selectedCleanupIds.length"
            @click="executeCleanup"
            >清理所选内容</n-button
          >
        </section>
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
import { NAlert, NButton, NCheckbox, NCheckboxGroup, NDrawer, NDrawerContent, NInput, useMessage } from "naive-ui";
import {
  ApiHealthSchema,
  CleanupInspectionSchema,
  CleanupResultsSchema,
  listTools,
  type CleanupCategory,
  type ComponentPackageStatus
} from "@toolbox/shared";
import {
  AudioLines,
  ChevronRight,
  Clapperboard,
  LibraryBig,
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
  Settings,
  X,
  Wrench
} from "lucide-vue-next";
import { formatApiError, httpClient, isApiErrorCancelled } from "../services/http";
import { authenticateAdmin, restoreAdminSession, signOutAdmin } from "../services/admin-session";
import { useConfirmDialog } from "../composables/useConfirmDialog";
import { componentApi, getToolComponentReadiness } from "../services/components";

const route = useRoute();
const message = useMessage();
const confirm = useConfirmDialog();
const keyword = ref("");
const searchInput = ref<{ focus: () => void }>();
const isCompact = ref(typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
const desktopSidebarCollapsed = ref(false);
const mobileDrawerOpen = ref(false);
const serviceDrawerOpen = ref(false);
const apiState = ref<"checking" | "online" | "offline">("checking");
const serviceCheckedAt = ref("");
const deploymentMode = ref<"local" | "lan">("local");
const adminAuthenticated = ref(false);
const adminPin = ref("");
const adminLoading = ref(false);
const adminError = ref("");
let sessionRestoreAttempted = false;
const cleanupCategories = ref<CleanupCategory[]>([]);
const selectedCleanupIds = ref<string[]>([]);
const cleanupLoading = ref(false);
const cleanupExecuting = ref(false);
const cleanupError = ref("");
const componentStatuses = ref<ComponentPackageStatus[]>();
const componentStatusError = ref(false);
const tools = listTools();
const cleanupSelectedBytes = computed(() =>
  cleanupCategories.value
    .filter((item) => selectedCleanupIds.value.includes(item.id))
    .reduce((sum, item) => sum + item.bytes, 0)
);

const iconByTool: Record<string, unknown> = {
  "image-compress": ImageDown,
  "image-ai": ScanLine,
  "lan-transfer": FileArchive,
  "video-text": FileVideo,
  "edge-tts": AudioLines,
  "short-video": Clapperboard,
  "xhs-archive": LibraryBig
};

const filteredTools = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter((tool) => tool.title.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q));
});

const toolGroupDefinitions = [
  { label: "图片工具", ids: ["image-compress", "image-ai"] },
  { label: "视频与文案", ids: ["video-text", "edge-tts", "short-video", "xhs-archive"] },
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
const desktopCapabilityHint = computed(() => {
  if (!window.toolboxDesktop) return undefined;
  const titles: Record<string, string> = {
    "/tools/video-text": "视频转写能力",
    "/tools/edge-tts": "配音与参考音色能力",
    "/tools/image-ai": "AI 图片处理能力",
    "/tools/xhs-archive": "归档、翻译与登录浏览器能力"
  };
  const title = titles[route.path];
  if (!title) return undefined;
  const toolId = tools.find((tool) => tool.routePath === route.path)?.id;
  if (!toolId) return undefined;
  if (componentStatusError.value) {
    return {
      title,
      heading: "暂时无法读取能力状态",
      message:
        route.path === "/tools/xhs-archive"
          ? "已保存的归档仍可浏览；新归档、翻译和登录依赖能力目录，请稍后重试或前往设置。"
          : "可在设置中重试读取能力目录。",
      actionVisible: true,
      actionLabel: "查看能力管理"
    };
  }
  if (!componentStatuses.value) {
    return {
      title,
      heading: "正在读取能力状态",
      message: "正在检查此功能所需的已审核本地能力。",
      actionVisible: false,
      actionLabel: "查看能力管理"
    };
  }
  const readiness = getToolComponentReadiness(toolId, componentStatuses.value);
  if (!readiness.registered) {
    return {
      title,
      heading: "尚无已审核安装包",
      message:
        route.path === "/tools/xhs-archive"
          ? "已保存的归档仍可浏览；新归档、翻译和登录需要在设置中安装对应能力。"
          : "能力目录目前没有为此功能登记已签名的安装包，请在设置中检查可用能力。",
      actionVisible: true,
      actionLabel: "查看能力管理"
    };
  }
  if (!readiness.missing.length && !readiness.unresolvedIds.length) return undefined;
  const missingLabels = readiness.missing.map((component) =>
    component.installed ? `${component.displayName}（需要修复或重装）` : `${component.displayName}（未安装）`
  );
  missingLabels.push(...readiness.unresolvedIds.map((id) => `${id}（目录未提供）`));
  return {
    title,
    heading: "所需本地能力尚未就绪",
    message: `请先安装或修复：${missingLabels.join("、")}。页面不会在处理任务时自动下载能力。`,
    actionVisible: true,
    actionLabel: "前往设置安装"
  };
});

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
  // 抽屉打开时并行刷新服务状态和清理统计，主页面不因维护信息请求而阻塞。
  serviceDrawerOpen.value = true;
  void loadServiceStatus();
  void loadCleanup();
}

async function loadCleanup() {
  cleanupLoading.value = true;
  cleanupError.value = "";
  try {
    // 清理统计来自后端实际文件和元数据，前端只维护选择状态，不自行推算可删除范围。
    cleanupCategories.value = await httpClient.get("/maintenance/cleanup", CleanupInspectionSchema);
    if (!selectedCleanupIds.value.length)
      selectedCleanupIds.value = cleanupCategories.value.filter((item) => item.defaults).map((item) => item.id);
  } catch (error) {
    if (!isApiErrorCancelled(error)) cleanupError.value = formatApiError(error, "读取存储信息失败");
  } finally {
    cleanupLoading.value = false;
  }
}

async function executeCleanup() {
  const selected = cleanupCategories.value.filter((item) => selectedCleanupIds.value.includes(item.id));
  // 高风险类别需要二次确认；提交后重新读取统计，避免使用已过期的字节数。
  const highRisk = selected.some((item) => item.risk === "high");
  const accepted = await confirm(
    `将清理 ${selected.map((item) => item.label).join("、")}，预计释放 ${formatBytes(cleanupSelectedBytes.value)}。未勾选的数据不会改变。`,
    {
      title: highRisk ? "确认清理高风险数据" : "确认清理所选数据",
      positiveText: highRisk ? "永久删除所选数据" : "确认清理",
      danger: highRisk
    }
  );
  if (!accepted) return;
  cleanupExecuting.value = true;
  try {
    const results = await httpClient.post("/maintenance/cleanup", CleanupResultsSchema, {
      ids: selectedCleanupIds.value
    });
    const skippedItems = results.filter((item) => (item.skippedFiles ?? 0) > 0);
    if (skippedItems.length) {
      const summary = skippedItems
        .map((item) => `${item.label} ${item.skippedFiles} 个（${formatBytes(item.skippedBytes ?? 0)}）`)
        .join("、");
      message.warning(`部分文件被运行中的服务占用已跳过：${summary}`);
    } else {
      message.success("所选运行数据已清理");
    }
    selectedCleanupIds.value = [];
    await loadCleanup();
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "清理失败"));
  } finally {
    cleanupExecuting.value = false;
  }
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

async function loadServiceStatus() {
  apiState.value = "checking";
  try {
    // 健康检查失败只将状态标记为 offline，不影响已加载页面的本地交互。
    const health = await httpClient.get("/health", ApiHealthSchema);
    deploymentMode.value = health.deploymentMode;
    apiState.value = "online";
    if (deploymentMode.value === "lan" && !sessionRestoreAttempted) {
      // LAN 模式仅尝试恢复一次管理员会话，避免每次打开抽屉都重复请求或触发登录限流。
      sessionRestoreAttempted = true;
      try {
        await restoreAdminSession();
        adminAuthenticated.value = true;
      } catch {
        adminAuthenticated.value = false;
      }
    }
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

async function loginAdmin() {
  if (adminPin.value.length < 4) return;
  adminLoading.value = true;
  adminError.value = "";
  try {
    // PIN 只在 HTTPS/本机环境的会话请求中提交，成功后服务端通过 HttpOnly Cookie 维持会话。
    await authenticateAdmin(adminPin.value);
    adminPin.value = "";
    adminAuthenticated.value = true;
    message.success("管理员权限已解锁");
  } catch (error) {
    adminAuthenticated.value = false;
    if (!isApiErrorCancelled(error)) adminError.value = formatApiError(error, "管理员 PIN 验证失败");
  } finally {
    adminLoading.value = false;
  }
}

async function logoutAdmin() {
  adminLoading.value = true;
  adminError.value = "";
  try {
    await signOutAdmin();
    adminAuthenticated.value = false;
  } catch (error) {
    if (!isApiErrorCancelled(error)) adminError.value = formatApiError(error, "退出管理员会话失败");
  } finally {
    adminLoading.value = false;
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
  // 统一注册响应式布局和快捷键监听，卸载时成对移除，避免热更新叠加事件处理器。
  compactQuery = window.matchMedia("(max-width: 900px)");
  syncCompactLayout();
  compactQuery.addEventListener("change", syncCompactLayout);
  window.addEventListener("keydown", onWindowKeydown);
  void loadServiceStatus();
  if (
    window.toolboxDesktop &&
    ["/tools/video-text", "/tools/edge-tts", "/tools/image-ai", "/tools/xhs-archive"].includes(route.path)
  ) {
    void loadDesktopComponentStatuses();
  }
});

async function loadDesktopComponentStatuses() {
  componentStatusError.value = false;
  try {
    componentStatuses.value = await componentApi.list();
  } catch {
    componentStatusError.value = true;
  }
}

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

<style scoped>
.cleanup-section {
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle, #e7ebf1);
}
.admin-session-section {
  display: grid;
  gap: 12px;
  margin: 18px 0 4px;
  padding: 14px;
  border: 1px solid var(--border-subtle, #e7ebf1);
  border-radius: 10px;
  background: #f8fafc;
}
.admin-session-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.admin-session-heading > div {
  display: grid;
  gap: 3px;
}
.admin-session-heading small {
  color: #657085;
  line-height: 1.4;
}
.admin-session-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}
.cleanup-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}
.cleanup-heading div {
  display: grid;
  gap: 4px;
}
.cleanup-heading small {
  color: #7b8698;
  line-height: 1.45;
}
.cleanup-list {
  display: grid;
  gap: 4px;
  max-height: 310px;
  overflow-y: auto;
  padding-right: 4px;
}
.cleanup-list :deep(.n-checkbox) {
  align-items: flex-start;
  padding: 7px 0;
}
.cleanup-option {
  display: grid;
  gap: 2px;
}
.cleanup-option > span {
  display: flex;
  align-items: center;
  gap: 7px;
}
.cleanup-option em {
  border-radius: 5px;
  padding: 1px 5px;
  color: #c8324d;
  background: #fff0f2;
  font-size: 11px;
  font-style: normal;
}
.cleanup-option em.stop-hint {
  color: #9a6700;
  background: #fff8dc;
}
.cleanup-option small {
  color: #8a94a6;
}
.cleanup-total {
  display: flex;
  justify-content: space-between;
  margin: 14px 0 10px;
  color: #657085;
}
.cleanup-total strong {
  color: #243047;
}
.desktop-capability-hint {
  width: min(100%, 1280px);
  margin: 0 auto 14px;
}
.desktop-capability-hint-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.desktop-capability-hint-content p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}
@media (max-width: 640px) {
  .desktop-capability-hint-content {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
