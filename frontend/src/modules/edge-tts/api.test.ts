import { beforeEach, describe, expect, it, vi } from "vitest";
import { edgeTtsApi } from "./api";

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn()
}));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: httpMock
}));

describe("edge tts api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a task with bounded request timeout", async () => {
    httpMock.post.mockResolvedValue({ id: "tts-1" });
    const input = {
      text: "Selamat datang",
      language: "ms-MY" as const,
      voice: "ms-MY-YasminNeural",
      rate: 0,
      volume: 0,
      pitch: 0,
      includeSubtitles: true
    };

    await edgeTtsApi.create(input);

    expect(httpMock.post).toHaveBeenCalledWith("/tools/edge-tts/tasks", input, { timeout: 30_000 });
  });

  it("loads locale voices and paginated history", async () => {
    httpMock.get.mockResolvedValue({});
    await edgeTtsApi.voices("en-GB");
    await edgeTtsApi.list(2, 10);

    expect(httpMock.get).toHaveBeenNthCalledWith(1, "/tools/edge-tts/voices", { params: { language: "en-GB" } });
    expect(httpMock.get).toHaveBeenNthCalledWith(2, "/tools/edge-tts/tasks", { params: { page: 2, pageSize: 10 } });
  });

  it("requests Brazilian Portuguese voices and preserves accented text", async () => {
    const input = {
      text: "Olá! Confira nossas promoções.",
      language: "pt-BR" as const,
      voice: "pt-BR-FranciscaNeural",
      rate: 0,
      volume: 0,
      pitch: 0,
      includeSubtitles: true
    };
    await edgeTtsApi.voices("pt-BR");
    await edgeTtsApi.create(input);
    expect(httpMock.get).toHaveBeenCalledWith("/tools/edge-tts/voices", { params: { language: "pt-BR" } });
    expect(httpMock.post).toHaveBeenCalledWith("/tools/edge-tts/tasks", input, { timeout: 30_000 });
  });
});
