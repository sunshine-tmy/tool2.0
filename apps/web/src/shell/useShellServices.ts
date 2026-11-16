import { computed, onBeforeUnmount, ref } from "vue";
import { ApiHealthSchema } from "@toolbox/shared";
import { httpClient } from "../shared/http/http";
import { diagnosticConnection, diagnosticsApi, localDiagnosticsAvailable } from "../shared/http/diagnostics";
export function useShellServices() {
  const serviceStatusLabel = computed(() =>
    diagnosticConnection.value === "offline"
      ? "基础服务异常"
      : diagnosticConnection.value === "checking"
        ? "正在启动"
        : diagnosticConnection.value === "partial"
          ? "部分能力不可用"
          : "基础服务正常"
  );

  const serviceDrawerOpen = ref(false);
  const apiState = ref<"checking" | "online" | "offline">("checking");
  const serviceCheckedAt = ref("");
  let diagnosticTimer: ReturnType<typeof setInterval> | undefined;
  function openServiceDrawer() {
    serviceDrawerOpen.value = true;
    void loadServiceStatus();
  }
  async function loadServiceStatus() {
    apiState.value = "checking";
    try {
      // 健康检查失败只将状态标记为 offline，不影响已加载页面的本地交互。
      await httpClient.get("/health", ApiHealthSchema);
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

  function startDiagnostics() {
    if (localDiagnosticsAvailable) void diagnosticsApi.snapshot().catch(() => undefined);
    if (localDiagnosticsAvailable)
      diagnosticTimer = setInterval(() => {
        void diagnosticsApi.snapshot(true).catch(() => undefined);
      }, 15000);
  }
  onBeforeUnmount(() => {
    clearInterval(diagnosticTimer);
  });
  return {
    serviceStatusLabel,
    serviceDrawerOpen,
    apiState,
    serviceCheckedAt,
    openServiceDrawer,
    loadServiceStatus,
    startDiagnostics
  };
}
