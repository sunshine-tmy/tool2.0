<!-- 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力 -->
<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider :max="diagnosticConnection === 'offline' ? 1 : undefined">
      <n-dialog-provider>
        <AudioLibraryPlayback />
        <DiagnosticPlaybackGuard />
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
import { NConfigProvider, NDialogProvider, NMessageProvider } from "naive-ui";
import { createTheme } from "./theme";
import UiErrorBoundary from "../shared/ui/UiErrorBoundary.vue";
import RouteLoading from "../shared/ui/RouteLoading.vue";
import { AudioLibraryPlayback } from "../features/audio-library/integrations/playback";
import DiagnosticPlaybackGuard from "./DiagnosticPlaybackGuard.vue";
import { diagnosticConnection } from "../shared/http/diagnostic-connection";

const themeOverrides = createTheme(getComputedStyle(document.documentElement));
</script>

<style scoped>
.route-view {
  display: contents;
}
</style>
