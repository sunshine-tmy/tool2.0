<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
<template>
  <main class="workspace ui-v2" :class="{ 'has-desktop-titlebar': isDesktop }">
    <div v-if="isDesktop" class="desktop-window-titlebar" aria-hidden="true">
      <span>电商工具箱</span>
    </div>
    <header ref="topbar" class="topbar">
      <div class="topbar-leading">
        <n-button
          v-if="currentTool"
          class="module-sidebar-toggle"
          quaternary
          circle
          :aria-label="sidebarCollapsed ? '展开模块导航' : '收起模块导航'"
          :title="sidebarCollapsed ? '展开模块导航' : '收起模块导航'"
          :aria-expanded="!sidebarCollapsed"
          aria-controls="module-sidebar"
          @click="sidebarCollapsed = !sidebarCollapsed"
          ><template #icon><PanelLeft :size="19" /></template
        ></n-button>
        <router-link class="brand brand-link" to="/">
          <div class="brand-mark">
            <img class="brand-icon" :src="brandIcon" alt="" draggable="false" />
          </div>
          <div>
            <h1 class="brand-title">电商工具箱</h1>
            <p class="brand-subtitle">免登录，本地优先的素材处理工作台</p>
          </div>
        </router-link>
      </div>

      <div class="topbar-context">
        <span>{{ currentTool?.title || (route.path === "/" ? "本地素材工作台" : "工作台设置") }}</span>
      </div>

      <div class="topbar-actions" role="group" aria-label="应用设置与服务状态">
        <DesktopLanAccess v-if="isDesktop" />
        <n-button
          v-if="localDiagnosticsAvailable"
          class="shell-icon-button"
          :style="shellIconButtonStyle"
          quaternary
          circle
          aria-label="桌面设置"
          title="桌面设置"
          @click="$router.push('/settings')"
        >
          <template #icon><Settings :size="19" /></template>
        </n-button>
        <n-button
          v-if="!isDesktop"
          class="shell-icon-button"
          :style="shellIconButtonStyle"
          quaternary
          circle
          aria-label="本地服务与管理员会话"
          title="本地服务与管理员会话"
          @click="openServiceDrawer"
          ><template #icon><ServerCog :size="18" /></template
        ></n-button>
        <button
          v-if="localDiagnosticsAvailable"
          type="button"
          class="topbar-status"
          :class="{
            'is-offline': diagnosticConnection === 'offline',
            'is-loading': diagnosticConnection === 'checking',
            'is-partial': diagnosticConnection === 'partial'
          }"
          :aria-label="`${serviceStatusLabel}，查看环境诊断`"
          :title="`${serviceStatusLabel}，查看环境诊断`"
          @click="$router.push('/settings/diagnostics')"
        >
          <span class="status-dot" aria-hidden="true" />
          <span class="topbar-status-label">{{ serviceStatusLabel }}</span>
          <ChevronRight :size="15" aria-hidden="true" />
        </button>
      </div>
    </header>

    <section
      class="shell"
      :class="{
        'has-module-sidebar': Boolean(currentTool),
        'module-sidebar-collapsed': sidebarCollapsed,
        'has-module-footer': Boolean($slots['module-footer'])
      }"
    >
      <ModuleSidebar
        v-if="currentTool"
        :current-tool-id="currentTool.id"
        :collapsed="sidebarCollapsed"
        :show-settings="localDiagnosticsAvailable"
      />
      <div
        class="content"
        :class="{
          'home-content': route.path === '/',
          'compress-content': route.path === '/tools/image-compress'
        }"
      >
        <nav v-if="route.path !== '/'" class="workspace-breadcrumb" aria-label="当前位置">
          <router-link to="/"><ArrowLeft :size="16" />返回首页</router-link>
          <span aria-hidden="true">/</span>
          <router-link v-if="route.path.startsWith('/tools/media-archive/')" to="/tools/media-archive"
            >多媒体内容归档</router-link
          >
          <span v-else>{{
            currentTool?.title ||
            (route.path.includes("data-backup")
              ? "数据备份与恢复"
              : route.path.includes("diagnostics")
                ? "启动与环境诊断"
                : "桌面设置")
          }}</span>
        </nav>
        <n-alert
          v-if="
            localDiagnosticsAvailable && diagnosticConnection === 'offline' && route.path !== '/settings/diagnostics'
          "
          type="warning"
          :bordered="false"
          class="shell-notice shell-service-warning"
        >
          本地服务暂不可用，已加载的内容不会被清除。<n-button
            text
            type="primary"
            @click="
              $router.push({
                path: '/settings/diagnostics',
                query: { module: route.path.split('/').pop() }
              })
            "
            >查看诊断</n-button
          >
        </n-alert>
        <n-alert
          v-if="desktopCapabilityHint"
          type="info"
          :bordered="false"
          class="shell-notice desktop-capability-hint"
        >
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
            <n-button
              size="small"
              secondary
              @click="
                $router.push({
                  path: '/settings/diagnostics',
                  query: { module: route.path.split('/').pop() }
                })
              "
              >查看诊断</n-button
            >
          </div>
        </n-alert>
        <slot />
      </div>
      <div v-if="$slots['module-footer']" class="module-footer"><slot name="module-footer" /></div>
    </section>

    <n-drawer v-if="!isDesktop" v-model:show="serviceDrawerOpen" :width="380" placement="right">
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
import { computed, defineAsyncComponent, onMounted, provide, ref } from "vue";
import { useRoute } from "vue-router";
import brandIcon from "../assets/ui-v2/brand.webp";
import { toolForPath, toolPresentationKey, workbenchTools } from "../shared/ui/tool/catalog";
import { NAlert, NButton, NDrawer, NDrawerContent, NInput } from "naive-ui";
import { ChevronRight, ArrowLeft, PanelLeft, RefreshCw, ServerCog, Settings, Wrench } from "lucide-vue-next";
import ModuleSidebar from "./ModuleSidebar.vue";
import { diagnosticConnection, localDiagnosticsAvailable } from "../shared/http/diagnostics";
import { useShellNavigation } from "./useShellNavigation";
import { useShellServices } from "./useShellServices";
import { useShellOverlayBoundary } from "./useShellOverlayBoundary";
import { useDesktopCapabilityHint } from "../integrations/desktop/useDesktopCapabilityHint";
const DesktopLanAccess = defineAsyncComponent(() => import("../integrations/desktop/DesktopLanAccess.vue"));
const route = useRoute(),
  isDesktop = computed(() => Boolean(window.toolboxDesktop));
const topbar = ref<HTMLElement>();
const sidebarCollapsed = ref(false);
useShellOverlayBoundary(topbar);
const shellIconButtonStyle = {
  width: "var(--shell-icon-size, 36px)",
  height: "var(--shell-icon-size, 36px)"
};
const tools = workbenchTools();
const currentTool = computed(() => toolForPath(route.path));
provide(toolPresentationKey, currentTool);
const { iconByTool, startNavigation } = useShellNavigation();
const {
  serviceStatusLabel,
  serviceDrawerOpen,
  apiState,
  serviceCheckedAt,
  deploymentMode,
  adminAuthenticated,
  adminPin,
  adminLoading,
  adminError,
  openServiceDrawer,
  loadServiceStatus,
  loginAdmin,
  logoutAdmin,
  startDiagnostics
} = useShellServices();
const { desktopCapabilityHint, loadDesktopComponentStatuses } = useDesktopCapabilityHint();
onMounted(() => {
  startDiagnostics();
  startNavigation();
  if (!isDesktop.value) void loadServiceStatus();
  if (window.toolboxDesktop && ["/tools/edge-tts", "/tools/image-ai", "/tools/media-archive"].includes(route.path))
    void loadDesktopComponentStatuses();
});
</script>

<style scoped>
/* 仅隐藏常驻说明和环境摘要，保留报错、任务状态及实际操作控件。 */
.workspace.ui-v2 :deep(.license-note),
.workspace.ui-v2 :deep(.platform-runtime),
.workspace.ui-v2 :deep(.rights-alert),
.workspace.ui-v2 :deep(.edge-tts-privacy),
.workspace.ui-v2 :deep(.chatterbox-notice),
.workspace.ui-v2 :deep(.local-processing-note),
.workspace.ui-v2 :deep(.module-advisory-note) {
  display: none;
}
.ui-v2 .shell.has-module-sidebar {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  overflow: hidden;
}
.ui-v2 .shell.has-module-sidebar.module-sidebar-collapsed {
  grid-template-columns: 68px minmax(0, 1fr);
}
.shell.has-module-sidebar > .content {
  min-width: 0;
  min-height: 0;
}
.ui-v2 .shell.has-module-footer {
  grid-template-rows: minmax(0, 1fr) auto;
}
.shell.has-module-footer > :deep(.module-sidebar) {
  grid-column: 1;
  grid-row: 1 / -1;
}
.shell.has-module-footer > .content {
  grid-column: 2;
  grid-row: 1;
}
.module-footer {
  grid-column: 2;
  grid-row: 2;
  min-width: 0;
  position: relative;
  z-index: 10;
}
.module-sidebar-toggle {
  color: var(--color-text-secondary);
}
@media (max-width: 900px) {
  .ui-v2 .shell.has-module-sidebar {
    grid-template-columns: 68px minmax(0, 1fr);
  }
  .module-sidebar-toggle {
    display: none;
  }
}
.workspace.has-desktop-titlebar {
  grid-template-rows: env(titlebar-area-height, 0px) auto minmax(0, 1fr);
}
.desktop-window-titlebar {
  height: env(titlebar-area-height, 0px);
  overflow: hidden;
  background: var(--color-surface-subtle);
}
.desktop-window-titlebar > span {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: env(titlebar-area-width, 100%);
  height: 100%;
  margin-left: env(titlebar-area-x, 0px);
  padding: 0 16px;
  overflow: hidden;
  color: #243047;
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
  -webkit-app-region: drag;
}
.shell-notice {
  grid-column: 1 / -1;
  align-self: start;
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
