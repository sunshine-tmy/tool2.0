/**
 * 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互
 */
import {
  ChatterboxBatchItemRemovalSchema,
  ChatterboxBatchListSchema,
  ChatterboxBatchSchema,
  ChatterboxHealthSchema,
  ChatterboxLanguage,
  ChatterboxRemovalSchema,
  ChatterboxSavedVoiceListSchema,
  ChatterboxSavedVoiceSchema,
  ChatterboxSubtitleMode,
  ChatterboxTaskListSchema,
  ChatterboxTaskSchema,
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
      () => httpClient.get("/tools/edge-tts/chatterbox/health", ChatterboxHealthSchema),
      "无法读取声音克隆服务状态"
    );
  },

  create(input: ChatterboxCreateTaskInput) {
    // multipart 字段与共享 Schema 对齐；文件保持原名，文本和数值参数显式序列化。
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
      () => httpClient.post("/tools/edge-tts/chatterbox/tasks", ChatterboxTaskSchema, form, { timeout: 120_000 }),
      "创建声音克隆任务失败"
    );
  },

  createBatch(input: ChatterboxCreateBatchInput) {
    // 批次段落作为 JSON 字段传输，服务端负责数量、文本长度和授权约束的最终校验。
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
      () => httpClient.post("/tools/edge-tts/chatterbox/batches", ChatterboxBatchSchema, form, { timeout: 120_000 }),
      "创建声音克隆批次失败"
    );
  },

  voices() {
    return withApiError(
      () => httpClient.get("/tools/edge-tts/chatterbox/voices", ChatterboxSavedVoiceListSchema),
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
      () =>
        httpClient.post("/tools/edge-tts/chatterbox/voices", ChatterboxSavedVoiceSchema, form, {
          timeout: 120_000
        }),
      "保存永久参考音色失败"
    );
  },

  removeVoice(voiceId: string) {
    return withApiError(
      () => httpClient.delete(`/tools/edge-tts/chatterbox/voices/${voiceId}`, ChatterboxRemovalSchema),
      "删除永久参考音色失败"
    );
  },

  batch(batchId: string) {
    return withApiError(
      () => httpClient.get(`/tools/edge-tts/chatterbox/batches/${batchId}`, ChatterboxBatchSchema),
      "读取声音克隆批次失败"
    );
  },

  batches(page = 1, pageSize = 10) {
    return withApiError(
      () =>
        httpClient.get("/tools/edge-tts/chatterbox/batches", ChatterboxBatchListSchema, {
          params: { page, pageSize }
        }),
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
    // 重生成只提交当前段的覆盖参数，未提供的值由服务端沿用批次默认值。
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
        httpClient.post(
          `/tools/edge-tts/chatterbox/batches/${batchId}/items/${itemId}/regenerate`,
          ChatterboxBatchSchema,
          form,
          { timeout: 120_000 }
        ),
      "重新生成文案段失败"
    );
  },

  reorder(batchId: string, itemIds: string[]) {
    return withApiError(
      () => httpClient.patch(`/tools/edge-tts/chatterbox/batches/${batchId}/order`, ChatterboxBatchSchema, { itemIds }),
      "调整文案顺序失败"
    );
  },

  removeBatchItem(batchId: string, itemId: string) {
    return withApiError(
      () =>
        httpClient.delete(
          `/tools/edge-tts/chatterbox/batches/${batchId}/items/${itemId}`,
          ChatterboxBatchItemRemovalSchema
        ),
      "删除文案段失败"
    );
  },

  cancelBatch(batchId: string) {
    return withApiError(
      () => httpClient.post(`/tools/edge-tts/chatterbox/batches/${batchId}/cancel`, ChatterboxBatchSchema),
      "取消批次失败"
    );
  },

  removeBatchReference(batchId: string) {
    return withApiError(
      () => httpClient.delete(`/tools/edge-tts/chatterbox/batches/${batchId}/reference`, ChatterboxRemovalSchema),
      "删除参考音色失败"
    );
  },

  removeBatch(batchId: string) {
    return withApiError(
      () => httpClient.delete(`/tools/edge-tts/chatterbox/batches/${batchId}`, ChatterboxRemovalSchema),
      "删除声音克隆批次失败"
    );
  },

  task(taskId: string) {
    return withApiError(
      () => httpClient.get(`/tools/edge-tts/chatterbox/tasks/${taskId}`, ChatterboxTaskSchema),
      "读取声音克隆任务失败"
    );
  },

  list(page = 1, pageSize = 10) {
    return withApiError(
      () =>
        httpClient.get("/tools/edge-tts/chatterbox/tasks", ChatterboxTaskListSchema, { params: { page, pageSize } }),
      "读取声音克隆记录失败"
    );
  },

  remove(taskId: string) {
    return withApiError(
      () => httpClient.delete(`/tools/edge-tts/chatterbox/tasks/${taskId}`, ChatterboxRemovalSchema),
      "删除声音克隆任务失败"
    );
  }
};
