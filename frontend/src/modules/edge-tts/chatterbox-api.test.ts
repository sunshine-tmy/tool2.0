import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatterboxApi } from "./chatterbox-api";

const httpMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: httpMock
}));

describe("chatterbox api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the reference file, authorization and generation controls as multipart data", async () => {
    httpMock.post.mockResolvedValue({ id: "clone-1" });
    const reference = new File([new Uint8Array([1, 2, 3])], "voice.wav", { type: "audio/wav" });

    await chatterboxApi.create({
      reference,
      text: "Selamat datang",
      language: "ms",
      authorization: "self",
      consentConfirmed: true,
      exaggeration: 0.5,
      cfgWeight: 0.5,
      temperature: 0.8,
      seed: 7,
      includeSubtitles: true,
      fileName: "demo"
    });

    const [url, form, config] = httpMock.post.mock.calls[0] as [string, FormData, { timeout: number }];
    expect(url).toBe("/tools/edge-tts/chatterbox/tasks");
    expect(form.get("reference")).toMatchObject({ name: "voice.wav", size: 3, type: "audio/wav" });
    expect(form.get("authorization")).toBe("self");
    expect(form.get("consentConfirmed")).toBe("true");
    expect(form.get("language")).toBe("ms");
    expect(config).toEqual({ timeout: 120_000 });
  });

  it("loads paginated clone history", async () => {
    httpMock.get.mockResolvedValue({});
    await chatterboxApi.list(2, 8);
    expect(httpMock.get).toHaveBeenCalledWith("/tools/edge-tts/chatterbox/tasks", {
      params: { page: 2, pageSize: 8 }
    });
  });
});
