import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { listTools, type ComponentPackageStatus } from "@toolbox/shared";
import { componentApi } from "./capabilities";
import { getToolComponentReadiness } from "./capability-readiness";
export function useDesktopCapabilityHint() {
  const route = useRoute(),
    tools = listTools();
  const componentStatuses = ref<ComponentPackageStatus[]>();
  const componentStatusError = ref(false);

  const desktopCapabilityHint = computed(() => {
    if (!window.toolboxDesktop) return undefined;
    const titles: Record<string, string> = {
      "/tools/edge-tts": "配音与参考音色能力",
      "/tools/image-ai": "AI 图片处理能力",
      "/tools/media-archive": "多媒体归档、翻译与登录浏览器能力"
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
          route.path === "/tools/media-archive"
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
          route.path === "/tools/media-archive"
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

  async function loadDesktopComponentStatuses() {
    componentStatusError.value = false;
    try {
      componentStatuses.value = await componentApi.list();
    } catch {
      componentStatusError.value = true;
    }
  }

  return { desktopCapabilityHint, loadDesktopComponentStatuses };
}
