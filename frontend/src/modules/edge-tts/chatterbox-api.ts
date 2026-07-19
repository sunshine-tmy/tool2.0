import type {
  ChatterboxHealth,
  ChatterboxLanguage,
  ChatterboxTask,
  ChatterboxTaskList,
  ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";

type ChatterboxCreateTaskInput = {
  reference: File;
  text: string;
  language: ChatterboxLanguage;
  authorization: ChatterboxVoiceAuthorization;
  consentConfirmed: boolean;
  exaggeration: number;
  cfgWeight: number;
  temperature: number;
  seed: number;
  includeSubtitles: boolean;
  fileName?: string;
};

export const chatterboxApi = {
  health() {
    return withApiError(
      () => httpClient.get<ChatterboxHealth>("/tools/edge-tts/chatterbox/health"),
      "无法读取声音克隆服务状态"
    );
  },

  create(input: ChatterboxCreateTaskInput) {
    const form = new FormData();
    form.append("reference", input.reference, input.reference.name);
    form.append("text", input.text);
    form.append("language", input.language);
    form.append("authorization", input.authorization);
    form.append("consentConfirmed", String(input.consentConfirmed));
    form.append("exaggeration", String(input.exaggeration));
    form.append("cfgWeight", String(input.cfgWeight));
    form.append("temperature", String(input.temperature));
    form.append("seed", String(input.seed));
    form.append("includeSubtitles", String(input.includeSubtitles));
    if (input.fileName) form.append("fileName", input.fileName);
    return withApiError(
      () => httpClient.post<ChatterboxTask>("/tools/edge-tts/chatterbox/tasks", form, { timeout: 120_000 }),
      "创建声音克隆任务失败"
    );
  },

  task(taskId: string) {
    return withApiError(
      () => httpClient.get<ChatterboxTask>(`/tools/edge-tts/chatterbox/tasks/${taskId}`),
      "读取声音克隆任务失败"
    );
  },

  list(page = 1, pageSize = 10) {
    return withApiError(
      () => httpClient.get<ChatterboxTaskList>("/tools/edge-tts/chatterbox/tasks", { params: { page, pageSize } }),
      "读取声音克隆记录失败"
    );
  },

  remove(taskId: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/edge-tts/chatterbox/tasks/${taskId}`),
      "删除声音克隆任务失败"
    );
  }
};
