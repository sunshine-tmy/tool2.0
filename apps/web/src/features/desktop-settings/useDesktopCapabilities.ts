import { computed, ref } from "vue";
import { useMessage } from "naive-ui";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
import { nextTick, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import type { ComponentGroup, ComponentJob, ComponentPackageStatus } from "@toolbox/shared";
import { componentApi, subscribeComponentJob } from "../../integrations/desktop/capabilities";
import { formatBytesThroughGb as formatBytes } from "../../shared/utils/format-bytes";
export function useDesktopCapabilities() {
  const desktop = computed(() => window.toolboxDesktop),
    route = useRoute(),
    message = useMessage(),
    confirm = useConfirmDialog();
  const offlineArchiveInput = ref<HTMLInputElement>();
  const pendingOfflineImport = ref<ComponentPackageStatus>();
  const offlineUpload = ref<{ componentId: string; progress: number; controller: AbortController }>();

  const components = ref<ComponentPackageStatus[]>([]);
  const componentJobs = ref<Record<string, ComponentJob>>({});
  const componentsLoading = ref(false);
  const componentsError = ref("");
  const componentsNotice = ref("");
  const startingComponentId = ref("");
  const cancelingJobId = ref("");

  const jobSubscriptions = new Map<string, () => void>();

  const componentGroupLabels: Record<ComponentGroup, string> = {
    shared: "共享基础能力",
    media: "视频与媒体",
    audio: "语音与配音",
    image: "AI 图片处理",
    archive: "多媒体内容归档",
    translation: "翻译"
  };
  const componentGroups = computed(() => {
    const order: ComponentGroup[] = ["shared", "media", "audio", "image", "archive", "translation"];
    return order
      .map((id) => ({
        id,
        label: componentGroupLabels[id],
        items: components.value.filter((item) => item.groupId === id)
      }))
      .filter((group) => group.items.length);
  });
  const componentTotalLabel = computed(() => {
    if (!components.value.length) return "";
    const totalDownloadBytes = components.value.reduce((sum, item) => sum + item.downloadBytes, 0);
    const totalInstalledBytes = components.value.reduce((sum, item) => sum + item.installedBytes, 0);
    return `已审核 ${components.value.length} 项 · 下载合计 ${formatBytes(totalDownloadBytes)} · 全部安装后约 ${formatBytes(totalInstalledBytes)}`;
  });

  onBeforeUnmount(() => {
    offlineUpload.value?.controller.abort();
    for (const unsubscribe of jobSubscriptions.values()) unsubscribe();
    jobSubscriptions.clear();
  });

  async function loadComponents() {
    if (!desktop.value) return;
    componentsLoading.value = true;
    componentsError.value = "";
    try {
      components.value = await componentApi.list();
      const componentId = route.query.component;
      if (typeof componentId === "string" && /^[a-z0-9-]{1,80}$/.test(componentId)) {
        await nextTick();
        document.getElementById(`capability-${componentId}`)?.scrollIntoView({ block: "center" });
      }
      // 组件卡片在页面刷新后通过服务端公开的 activeJobId 恢复进度订阅。
      await Promise.all(
        components.value
          .filter((component) => component.activeJobId && !componentJobs.value[component.id])
          .map(async (component) => {
            try {
              trackComponentJob(await componentApi.getJob(component.activeJobId!));
            } catch {
              // 作业可能刚完成或服务刚重启；重新读取目录即可显示实际已安装状态。
            }
          })
      );
    } catch (cause) {
      componentsError.value = formatApiError(cause, "读取能力目录失败");
    } finally {
      componentsLoading.value = false;
    }
  }

  async function installComponent(component: ComponentPackageStatus) {
    const packageInfo =
      component.licenseName === "内部使用" ? "该能力包用于组织内部。" : `许可信息：${component.licenseName}。`;
    const accepted = await confirm(
      `将下载“${component.displayName}”约 ${formatBytes(component.downloadBytes)}，安装后约占用 ${formatBytes(component.installedBytes)}。${packageInfo}后端会在下载前复核磁盘空间，安装失败不会替换健康版本。${formatInstallConditions(component)}`,
      { title: "确认安装能力", positiveText: "开始安装" }
    );
    if (accepted) await startComponentOperation(component, "install");
  }

  async function reinstallComponent(component: ComponentPackageStatus) {
    const accepted = await confirm(
      `将重新下载并校验“${component.displayName}”。新版本通过自检前会保留当前版本，失败时不会破坏现有可用能力。作品与历史数据不受影响。`,
      { title: "确认重装能力", positiveText: "开始重装" }
    );
    if (accepted) await startComponentOperation(component, "reinstall");
  }

  function selectOfflineImport(component: ComponentPackageStatus) {
    if (startingComponentId.value || offlineUpload.value) return;
    pendingOfflineImport.value = component;
    if (!offlineArchiveInput.value) {
      componentsError.value = "无法打开离线能力包选择器，请重启桌面应用后重试";
      return;
    }
    offlineArchiveInput.value.value = "";
    offlineArchiveInput.value.click();
  }

  async function handleOfflineArchiveSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = "";
    const component = pendingOfflineImport.value;
    pendingOfflineImport.value = undefined;
    if (!component || !files.length) return;
    if (files.some((file) => !file.name.toLowerCase().endsWith(".tar.gz"))) {
      message.error("请选择能力管理器提供的 .tar.gz 能力包");
      return;
    }
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes !== component.downloadBytes) {
      message.error(
        `所选文件合计 ${formatBytes(totalBytes)}，当前目录要求 ${formatBytes(component.downloadBytes)}；请确认版本和分卷完整`
      );
      return;
    }
    const accepted = await confirm(
      `将把所选 ${files.length} 个文件（${formatBytes(totalBytes)}）上传到本机，并按应用内受信任清单校验大小、SHA-256、签名文件清单和运行时自检。校验失败不会替换现有可用版本。请先安装该能力缺少的依赖。`,
      { title: `离线导入“${component.displayName}”`, positiveText: "校验并导入" }
    );
    if (!accepted || startingComponentId.value || offlineUpload.value) return;

    const controller = new AbortController();
    startingComponentId.value = component.id;
    componentsError.value = "";
    componentsNotice.value = "";
    offlineUpload.value = { componentId: component.id, progress: 0, controller };
    try {
      const job = await componentApi.importOffline(component.id, files, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (offlineUpload.value?.controller === controller) {
            offlineUpload.value = { ...offlineUpload.value, progress };
          }
        }
      });
      trackComponentJob(job);
    } catch (cause) {
      if (controller.signal.aborted) message.info("离线包传输已取消，未安装任何文件");
      else componentsError.value = formatApiError(cause, "离线能力包导入失败");
    } finally {
      if (offlineUpload.value?.controller === controller) offlineUpload.value = undefined;
      if (startingComponentId.value === component.id) startingComponentId.value = "";
    }
  }

  function cancelOfflineImport(component: ComponentPackageStatus) {
    if (offlineUpload.value?.componentId === component.id) offlineUpload.value.controller.abort();
  }

  async function uninstallComponent(component: ComponentPackageStatus) {
    if (component.dependentIds.length) {
      message.warning(
        component.retired
          ? `请先将 ${component.dependentIds.join("、")} 更新至 Python 3.12 版本`
          : `该组件仍被 ${component.dependentIds.join("、")} 依赖，请先卸载依赖能力`
      );
      return;
    }
    const accepted = await confirm(
      component.retired
        ? "仅移除已不再被依赖的 Python 3.11 旧运行时。新的 Python 3.12、模型、个人音色、音频和其他业务数据均会保留。"
        : `将删除“${component.displayName}”的运行时、依赖和模型。作品、历史任务、个人素材、登录状态及其他应用数据均会保留。`,
      { title: "确认卸载能力", positiveText: "仅卸载能力", danger: true }
    );
    if (accepted) await startComponentOperation(component, "uninstall");
  }

  async function startComponentOperation(component: ComponentPackageStatus, operation: ComponentJob["operation"]) {
    if (startingComponentId.value) return;
    startingComponentId.value = component.id;
    componentsError.value = "";
    componentsNotice.value = "";
    try {
      const job =
        operation === "install"
          ? await componentApi.install(component.id)
          : operation === "reinstall"
            ? await componentApi.reinstall(component.id)
            : await componentApi.uninstall(component.id);
      trackComponentJob(job);
    } catch (cause) {
      componentsError.value = formatApiError(cause, "能力管理操作失败");
    } finally {
      startingComponentId.value = "";
    }
  }

  function trackComponentJob(job: ComponentJob) {
    if (["completed", "failed", "cancelled"].includes(job.state)) {
      finishComponentJob(job, false);
      return;
    }
    componentJobs.value = { ...componentJobs.value, [job.componentId]: job };
    if (jobSubscriptions.has(job.id)) return;
    const unsubscribe = subscribeComponentJob(
      job.id,
      (updated) => {
        if (["completed", "failed", "cancelled"].includes(updated.state)) {
          finishComponentJob(updated, true);
          return;
        }
        componentJobs.value = { ...componentJobs.value, [updated.componentId]: updated };
        componentsError.value = "";
        componentsNotice.value = "";
      },
      () => {
        componentsNotice.value = "进度连接暂时中断，正在自动重连；安装状态不会因此丢失。";
      }
    );
    jobSubscriptions.set(job.id, unsubscribe);
  }

  function finishComponentJob(job: ComponentJob, announce: boolean) {
    jobSubscriptions.get(job.id)?.();
    jobSubscriptions.delete(job.id);
    const { [job.componentId]: _finished, ...remainingJobs } = componentJobs.value;
    componentJobs.value = remainingJobs;
    if (announce) {
      if (job.state === "completed") message.success(`${operationName(job.operation)}已完成`);
      else if (job.state === "cancelled") message.info("能力下载已取消；当前可用版本未受影响");
      else message.error(job.errorMessage || `${operationName(job.operation)}失败`);
    }
    void loadComponents();
  }

  async function cancelComponentJob(job: ComponentJob) {
    cancelingJobId.value = job.id;
    componentsError.value = "";
    componentsNotice.value = "";
    try {
      trackComponentJob(await componentApi.cancel(job.id));
    } catch (cause) {
      componentsError.value = formatApiError(cause, "取消下载失败");
    } finally {
      cancelingJobId.value = "";
    }
  }

  function formatInstallConditions(component: ComponentPackageStatus) {
    return component.installConditions.length ? ` 安装条件：${component.installConditions.join("；")}。` : "";
  }

  function operationName(operation: ComponentJob["operation"]) {
    return { install: "安装", reinstall: "重装", uninstall: "卸载" }[operation];
  }

  return {
    offlineArchiveInput,
    offlineUpload,
    components,
    componentJobs,
    componentsLoading,
    componentsError,
    componentsNotice,
    startingComponentId,
    cancelingJobId,
    componentGroups,
    componentTotalLabel,
    loadComponents,
    installComponent,
    reinstallComponent,
    selectOfflineImport,
    handleOfflineArchiveSelection,
    cancelOfflineImport,
    uninstallComponent,
    cancelComponentJob
  };
}
