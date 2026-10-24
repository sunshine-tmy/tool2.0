import { computed, onBeforeUnmount, ref } from "vue";
import { useMessage } from "naive-ui";
import { ApiHealthSchema } from "@toolbox/shared";
import { formatApiError, httpClient, isApiErrorCancelled } from "../shared/http/http";
import { authenticateAdmin, restoreAdminSession, signOutAdmin } from "../shared/http/admin-session";
import { diagnosticConnection, diagnosticsApi, localDiagnosticsAvailable } from "../shared/http/diagnostics";
export function useShellServices() {
  const message = useMessage();
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
  const deploymentMode = ref<"local" | "lan">("local");
  const adminAuthenticated = ref(false);
  const adminPin = ref("");
  const adminLoading = ref(false);
  const adminError = ref("");
  let sessionRestoreAttempted = false;

  let diagnosticTimer: ReturnType<typeof setInterval> | undefined;
  function openServiceDrawer() {
    serviceDrawerOpen.value = true;
    void loadServiceStatus();
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
  };
}
