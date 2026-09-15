import { ImageAiHealthSchema, ImageAiTaskSchema, WatermarkSuggestionResponseSchema } from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";
import { resolveBackendUrl } from "../../config/runtime";

class ImageAiApi {
  async health() {
    return withApiError(() => httpClient.get("/tools/image-ai/health", ImageAiHealthSchema), "无法读取 AI 模型状态");
  }

  async suggestions(file: File) {
    const form = new FormData();
    form.append("file", file);
    return withApiError(
      () => httpClient.post("/tools/image-ai/watermark/suggestions", WatermarkSuggestionResponseSchema, form),
      "水印智能提示失败"
    );
  }

  async createTask(form: FormData) {
    return withApiError(
      () => httpClient.post("/tools/image-ai/tasks", ImageAiTaskSchema, form, { timeout: 220000 }),
      "创建图片处理任务失败"
    );
  }

  async getTask(taskId: string) {
    return withApiError(
      () => httpClient.get(`/tools/image-ai/tasks/${taskId}`, ImageAiTaskSchema),
      "读取图片处理任务失败"
    );
  }

  async cancelTask(taskId: string) {
    return withApiError(
      () => httpClient.delete(`/tools/image-ai/tasks/${taskId}`, ImageAiTaskSchema),
      "取消图片处理任务失败"
    );
  }
}

export const imageAiApi = new ImageAiApi();

export function absoluteImageAiUrl(url: string) {
  return resolveBackendUrl(url);
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
