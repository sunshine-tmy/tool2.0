import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatterboxBatchSchema, ChatterboxRemovalSchema, ChatterboxTaskListSchema } from "@toolbox/shared";
import { chatterboxApi } from "./chatterbox-api";

const httpMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: httpMock
}));

describe("chatterbox api", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["ms", "pt-BR"] as const)("sends reference audio and generation controls in %s", async (language) => {
    httpMock.post.mockResolvedValue({ id: "clone-1" });
    const reference = new File([new Uint8Array([1, 2, 3])], "voice.wav", { type: "audio/wav" });

    await chatterboxApi.create({
      reference,
      text: "Selamat datang",
      language,
      authorization: "self",
      consentConfirmed: true,
      exaggeration: 0.5,
      cfgWeight: 0.5,
      temperature: 0.8,
      seed: 7,
      includeSubtitles: true,
      fileName: "demo"
    });

    const [url, schema, form, config] = httpMock.post.mock.calls[0] as [string, unknown, FormData, { timeout: number }];
    expect(url).toBe("/tools/edge-tts/chatterbox/tasks");
    expect(schema).toBeDefined();
    expect(form.get("reference")).toMatchObject({ name: "voice.wav", size: 3, type: "audio/wav" });
    expect(form.get("authorization")).toBe("self");
    expect(form.get("consentConfirmed")).toBe("true");
    expect(form.get("language")).toBe(language);
    expect(config).toEqual({ timeout: 120_000 });
  });

  it("loads paginated clone history", async () => {
    httpMock.get.mockResolvedValue({});
    await chatterboxApi.list(2, 8);
    expect(httpMock.get).toHaveBeenCalledWith("/tools/edge-tts/chatterbox/tasks", ChatterboxTaskListSchema, {
      params: { page: 2, pageSize: 8 }
    });
  });

  it.each(["ms", "pt-BR"] as const)("creates an ordered multipart batch in %s", async (language) => {
    httpMock.post.mockResolvedValue({ id: "batch-1" });
    const reference = new File([new Uint8Array([1, 2, 3])], "voice.wav", { type: "audio/wav" });
    await chatterboxApi.createBatch({
      reference,
      segments: [
        { text: "Bahagian pertama.", referenceTranslation: "第一部分。", fileName: "one" },
        { text: "Bahagian kedua.", fileName: "two" }
      ],
      name: "demo-batch",
      language,
      authorization: "self",
      consentConfirmed: true,
      exaggeration: 0.5,
      cfgWeight: 0.5,
      temperature: 0.8,
      seed: 7,
      includeSubtitles: true,
      subtitleMode: "sentences",
      referenceRetained: true
    });

    const [url, , form] = httpMock.post.mock.calls[0] as [string, unknown, FormData];
    expect(url).toBe("/tools/edge-tts/chatterbox/batches");
    const segments = JSON.parse(String(form.get("segments")));
    expect(segments).toHaveLength(2);
    expect(segments[0].referenceTranslation).toBe("第一部分。");
    expect(form.get("subtitleMode")).toBe("sentences");
    expect(form.get("referenceRetained")).toBe("true");
    expect(form.get("language")).toBe(language);
  });

  it("reuses a permanent voice and sends per-item regeneration parameters", async () => {
    httpMock.post.mockResolvedValue({ id: "batch-1" });
    await chatterboxApi.createBatch({
      voiceId: "voice-1",
      segments: [{ text: "Saved voice text." }],
      language: "en",
      authorization: "self",
      consentConfirmed: true,
      exaggeration: 0.5,
      cfgWeight: 0.5,
      temperature: 0.8,
      seed: 0,
      includeSubtitles: true,
      subtitleMode: "sentences",
      referenceRetained: false
    });
    let [, , form] = httpMock.post.mock.calls[0] as [string, unknown, FormData];
    expect(form.get("voiceId")).toBe("voice-1");
    expect(form.get("reference")).toBeNull();

    await chatterboxApi.regenerate("batch-1", "item-1", {
      text: "Regenerated.",
      referenceTranslation: "重新生成的参考翻译。",
      seed: 12,
      exaggeration: 0.9,
      cfgWeight: 0.7,
      temperature: 0.4,
      voiceId: "voice-1"
    });
    [, , form] = httpMock.post.mock.calls[1] as [string, unknown, FormData];
    expect(form.get("exaggeration")).toBe("0.9");
    expect(form.get("referenceTranslation")).toBe("重新生成的参考翻译。");
    expect(form.get("cfgWeight")).toBe("0.7");
    expect(form.get("temperature")).toBe("0.4");
    expect(form.get("voiceId")).toBe("voice-1");
  });

  it("delegates saved voice, batch, item, task, cancellation and deletion operations", async () => {
    for (const method of Object.values(httpMock)) method.mockResolvedValue({});
    const reference = new File(["voice"], "voice.wav", { type: "audio/wav" });

    await chatterboxApi.health();
    await chatterboxApi.voices();
    await chatterboxApi.saveVoice({
      reference,
      name: "Narrator",
      language: "en",
      authorization: "self",
      consentConfirmed: true
    });
    await chatterboxApi.removeVoice("voice-1");
    await chatterboxApi.batch("batch-1");
    await chatterboxApi.batches(2, 5);
    await chatterboxApi.reorder("batch-1", ["item-2", "item-1"]);
    await chatterboxApi.removeBatchItem("batch-1", "item-1");
    await chatterboxApi.cancelBatch("batch-1");
    await chatterboxApi.removeBatchReference("batch-1");
    await chatterboxApi.removeBatch("batch-1");
    await chatterboxApi.task("task-1");
    await chatterboxApi.list(3, 4);
    await chatterboxApi.remove("task-1");
    await chatterboxApi.regenerate("batch-1", "item-1", {
      text: "again",
      fileName: "clip",
      reference,
      seed: 0
    });

    expect(httpMock.patch).toHaveBeenCalledWith(
      "/tools/edge-tts/chatterbox/batches/batch-1/order",
      ChatterboxBatchSchema,
      { itemIds: ["item-2", "item-1"] }
    );
    expect(httpMock.delete).toHaveBeenCalledWith("/tools/edge-tts/chatterbox/batches/batch-1", ChatterboxRemovalSchema);
    const regeneration = httpMock.post.mock.calls.at(-1)?.[2] as FormData;
    expect(regeneration.get("reference")).toMatchObject({ name: "voice.wav" });
  });
});
