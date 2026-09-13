import type {
  ChatterboxBatch,
  ChatterboxBatchList,
  ChatterboxHealth,
  ChatterboxLanguage,
  ChatterboxSavedVoice,
  ChatterboxSavedVoiceList,
  ChatterboxSubtitleMode,
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

type ChatterboxBatchSegmentInput = { text: string; referenceTranslation?: string; fileName?: string };

type ChatterboxCreateBatchInput = Omit<ChatterboxCreateTaskInput, "text" | "fileName" | "reference"> & {
  reference?: File;
  voiceId?: string;
  segments: ChatterboxBatchSegmentInput[];
  name?: string;
  referenceRetained: boolean;
  subtitleMode: ChatterboxSubtitleMode;
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

  createBatch(input: ChatterboxCreateBatchInput) {
    const form = new FormData();
    if (input.reference) form.append("reference", input.reference, input.reference.name);
    if (input.voiceId) form.append("voiceId", input.voiceId);
    form.append("segments", JSON.stringify(input.segments));
    form.append("language", input.language);
    form.append("authorization", input.authorization);
    form.append("consentConfirmed", String(input.consentConfirmed));
    form.append("exaggeration", String(input.exaggeration));
    form.append("cfgWeight", String(input.cfgWeight));
    form.append("temperature", String(input.temperature));
    form.append("seed", String(input.seed));
    form.append("includeSubtitles", String(input.includeSubtitles));
    form.append("subtitleMode", input.subtitleMode);
    form.append("referenceRetained", String(input.referenceRetained));
    if (input.name) form.append("name", input.name);
    return withApiError(
      () => httpClient.post<ChatterboxBatch>("/tools/edge-tts/chatterbox/batches", form, { timeout: 120_000 }),
      "创建声音克隆批次失败"
    );
  },

  voices() {
    return withApiError(
      () => httpClient.get<ChatterboxSavedVoiceList>("/tools/edge-tts/chatterbox/voices"),
      "读取永久参考音色失败"
    );
  },

  saveVoice(input: {
    reference: File;
    name: string;
    language: ChatterboxLanguage;
    authorization: ChatterboxVoiceAuthorization;
    consentConfirmed: boolean;
  }) {
    const form = new FormData();
    form.append("reference", input.reference, input.reference.name);
    form.append("name", input.name);
    form.append("language", input.language);
    form.append("authorization", input.authorization);
    form.append("consentConfirmed", String(input.consentConfirmed));
    return withApiError(
      () => httpClient.post<ChatterboxSavedVoice>("/tools/edge-tts/chatterbox/voices", form, { timeout: 120_000 }),
      "保存永久参考音色失败"
    );
  },

  removeVoice(voiceId: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/edge-tts/chatterbox/voices/${voiceId}`),
      "删除永久参考音色失败"
    );
  },

  batch(batchId: string) {
    return withApiError(
      () => httpClient.get<ChatterboxBatch>(`/tools/edge-tts/chatterbox/batches/${batchId}`),
      "读取声音克隆批次失败"
    );
  },

  batches(page = 1, pageSize = 10) {
    return withApiError(
      () => httpClient.get<ChatterboxBatchList>("/tools/edge-tts/chatterbox/batches", { params: { page, pageSize } }),
      "读取声音克隆批次失败"
    );
  },

  regenerate(
    batchId: string,
    itemId: string,
    input: {
      text: string;
      referenceTranslation?: string;
      fileName?: string;
      seed?: number;
      exaggeration?: number;
      cfgWeight?: number;
      temperature?: number;
      reference?: File;
      voiceId?: string;
    }
  ) {
    const form = new FormData();
    form.append("text", input.text);
    form.append("referenceTranslation", input.referenceTranslation || "");
    if (input.fileName) form.append("fileName", input.fileName);
    if (input.seed !== undefined) form.append("seed", String(input.seed));
    if (input.exaggeration !== undefined) form.append("exaggeration", String(input.exaggeration));
    if (input.cfgWeight !== undefined) form.append("cfgWeight", String(input.cfgWeight));
    if (input.temperature !== undefined) form.append("temperature", String(input.temperature));
    if (input.reference) form.append("reference", input.reference, input.reference.name);
    if (input.voiceId) form.append("voiceId", input.voiceId);
    return withApiError(
      () =>
        httpClient.post<ChatterboxBatch>(
          `/tools/edge-tts/chatterbox/batches/${batchId}/items/${itemId}/regenerate`,
          form,
          { timeout: 120_000 }
        ),
      "重新生成文案段失败"
    );
  },

  reorder(batchId: string, itemIds: string[]) {
    return withApiError(
      () => httpClient.patch<ChatterboxBatch>(`/tools/edge-tts/chatterbox/batches/${batchId}/order`, { itemIds }),
      "调整文案顺序失败"
    );
  },

  removeBatchItem(batchId: string, itemId: string) {
    return withApiError(
      () =>
        httpClient.delete<{ removed: boolean; batch?: ChatterboxBatch }>(
          `/tools/edge-tts/chatterbox/batches/${batchId}/items/${itemId}`
        ),
      "删除文案段失败"
    );
  },

  cancelBatch(batchId: string) {
    return withApiError(
      () => httpClient.post<ChatterboxBatch>(`/tools/edge-tts/chatterbox/batches/${batchId}/cancel`),
      "取消批次失败"
    );
  },

  removeBatchReference(batchId: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/edge-tts/chatterbox/batches/${batchId}/reference`),
      "删除参考音色失败"
    );
  },

  removeBatch(batchId: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/edge-tts/chatterbox/batches/${batchId}`),
      "删除声音克隆批次失败"
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
