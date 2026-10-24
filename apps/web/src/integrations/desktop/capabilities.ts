/** 中文模块说明：前端应用层，负责 桌面能力目录、安装作业及其进度订阅。 */
import {
  ComponentJobSchema,
  ComponentPackageListSchema,
  type ComponentJob,
  type ComponentPackageStatus
} from "@toolbox/shared/system";
import type { AxiosProgressEvent } from "axios";
import { Value } from "@sinclair/typebox/value";
import { resolveApiUrl } from "../../shared/config/runtime";
import { httpClient, withApiError } from "../../shared/http/http";

type OfflineImportOptions = {
  signal?: AbortSignal;
  onProgress?: (percentage: number, event: AxiosProgressEvent) => void;
};

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

  importOffline(componentId: string, files: File[], options: OfflineImportOptions = {}): Promise<ComponentJob> {
    const payload = new FormData();
    for (const file of files) payload.append("archives", file, file.name);
    return withApiError(
      () =>
        httpClient.post(`/components/${encodeURIComponent(componentId)}/offline-import`, ComponentJobSchema, payload, {
          timeout: 0,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          signal: options.signal,
          onUploadProgress: (event) => {
            if (event.progress !== undefined)
              options.onProgress?.(Math.min(100, Math.round(event.progress * 100)), event);
          }
        }),
      "导入离线能力包失败"
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
