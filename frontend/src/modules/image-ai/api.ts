import type {
  ImageAiHealth,
  ImageAiTask,
  WatermarkSuggestionResponse
} from "@toolbox/shared";
import { ApiRequest, api, httpClient } from "../../services/http";

class ImageAiApi {
  @ApiRequest("无法读取 AI 模型状态")
  async health() {
    return httpClient.get<ImageAiHealth>("/tools/image-ai/health");
  }

  @ApiRequest("水印智能提示失败")
  async suggestions(file: File) {
    const form = new FormData();
    form.append("file", file);
    return httpClient.post<WatermarkSuggestionResponse>("/tools/image-ai/watermark/suggestions", form);
  }

  @ApiRequest("创建图片处理任务失败")
  async createTask(form: FormData) {
    return httpClient.post<ImageAiTask>("/tools/image-ai/tasks", form, { timeout: 220000 });
  }

  @ApiRequest("读取图片处理任务失败")
  async getTask(taskId: string) {
    return httpClient.get<ImageAiTask>(`/tools/image-ai/tasks/${taskId}`);
  }

  @ApiRequest("取消图片处理任务失败")
  async cancelTask(taskId: string) {
    return httpClient.delete<ImageAiTask>(`/tools/image-ai/tasks/${taskId}`);
  }
}

export const imageAiApi = new ImageAiApi();

export function absoluteImageAiUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  const base = api.defaults.baseURL ?? "/api";
  const apiOrigin = base.replace(/\/api\/?$/, "");
  return `${apiOrigin}${url}`;
}

export function resultDownloadUrl(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return absoluteImageAiUrl(`${url}${separator}download=1`);
}

export function triggerImageAiDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = absoluteImageAiUrl(url);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
