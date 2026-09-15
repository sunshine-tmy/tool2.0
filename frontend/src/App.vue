<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <UiErrorBoundary>
          <router-view v-slot="{ Component }">
            <Suspense>
              <div class="route-view">
                <component :is="Component" />
              </div>
              <template #fallback><RouteLoading /></template>
            </Suspense>
          </router-view>
        </UiErrorBoundary>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NMessageProvider, type GlobalThemeOverrides } from "naive-ui";
import UiErrorBoundary from "./components/UiErrorBoundary.vue";
import RouteLoading from "./components/RouteLoading.vue";

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#2563eb",
    primaryColorHover: "#1d4ed8",
    primaryColorPressed: "#1e3a8a",
    primaryColorSuppl: "#0f766e",
    infoColor: "#0f766e",
    successColor: "#16a34a",
    warningColor: "#d97706",
    errorColor: "#dc2626",
    textColorBase: "#172033",
    bodyColor: "#f6f8fc",
    borderColor: "#e2e8f0",
    borderRadius: "8px",
    fontFamily:
      'Inter, "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  Button: {
    borderRadiusMedium: "8px",
    heightMedium: "40px",
    heightLarge: "44px"
  },
  Card: {
    borderRadius: "12px"
  },
  Input: {
    borderRadius: "8px",
    heightMedium: "40px"
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: "8px",
        heightMedium: "40px"
      }
    }
  }
};
</script>

<style scoped>
.route-view {
  display: contents;
}
</style>
