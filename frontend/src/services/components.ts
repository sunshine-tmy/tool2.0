/** 中文模块说明：前端应用层，负责 桌面能力目录、安装作业及其进度订阅。 */
import {
  ComponentJobSchema,
  ComponentPackageListSchema,
  type ComponentJob,
  type ComponentPackageStatus
} from "@toolbox/shared";
import { Value } from "@sinclair/typebox/value";
import { resolveApiUrl } from "../config/runtime";
import { httpClient, withApiError } from "./http";

export const componentApi = {
  list(): Promise<ComponentPackageStatus[]> {
    return withApiError(() => httpClient.get("/components", ComponentPackageListSchema), "读取能力目录失败");
  },

  install(componentId: string): Promise<ComponentJob> {
    return withApiError(
      () => httpClient.post(`/components/${encodeURIComponent(componentId)}/install`, ComponentJobSchema),
      "开始安装能力失败"
    );
  },

  reinstall(componentId: string): Promise<ComponentJob> {
    return withApiError(
      () => httpClient.post(`/components/${encodeURIComponent(componentId)}/reinstall`, ComponentJobSchema),
      "开始重装能力失败"
    );
  },

  uninstall(componentId: string): Promise<ComponentJob> {
    return withApiError(
      () => httpClient.delete(`/components/${encodeURIComponent(componentId)}`, ComponentJobSchema),
      "开始卸载能力失败"
    );
  },

  cancel(jobId: string): Promise<ComponentJob> {
    return withApiError(
      () => httpClient.delete(`/component-jobs/${encodeURIComponent(jobId)}`, ComponentJobSchema),
      "取消能力下载失败"
    );
  },

  getJob(jobId: string): Promise<ComponentJob> {
    return withApiError(
      () => httpClient.get(`/component-jobs/${encodeURIComponent(jobId)}`, ComponentJobSchema),
      "读取能力安装进度失败"
    );
  }
};

/** Resolve the direct packages and shared dependency chain required by one tool page. */
export function getToolComponentReadiness(toolId: string, components: ComponentPackageStatus[]) {
  const byId = new Map(components.map((component) => [component.id, component]));
  const requiredIds = new Set<string>();
  const unresolvedIds = new Set<string>();
  const visit = (componentId: string) => {
    if (requiredIds.has(componentId)) return;
    requiredIds.add(componentId);
    const component = byId.get(componentId);
    if (!component) {
      unresolvedIds.add(componentId);
      return;
    }
    for (const dependencyId of component.dependencyIds) visit(dependencyId);
  };

  const direct = components.filter((component) => component.taskToolIds.includes(toolId));
  direct.forEach((component) => visit(component.id));
  const required = [...requiredIds]
    .map((id) => byId.get(id))
    .filter((item): item is ComponentPackageStatus => Boolean(item));
  const missing = required.filter(
    (component) => !component.installed || component.health !== "healthy" || component.state !== "ready"
  );
  return { registered: direct.length > 0, required, missing, unresolvedIds: [...unresolvedIds] };
}

export function subscribeComponentJob(jobId: string, onJob: (job: ComponentJob) => void, onError?: () => void) {
  const source = new EventSource(resolveApiUrl(`/component-jobs/${encodeURIComponent(jobId)}/events`), {
    withCredentials: true
  });
  source.addEventListener("component-job", (event) => {
    try {
      const value: unknown = JSON.parse((event as MessageEvent<string>).data);
      if (Value.Check(ComponentJobSchema, value)) onJob(value as ComponentJob);
    } catch {
      // 丢弃无效事件；下一次事件或读取快照仍可恢复正确的作业状态。
    }
  });
  source.onerror = () => onError?.();
  return () => source.close();
}
