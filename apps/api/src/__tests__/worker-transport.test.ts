/** 固定客户端传输行为；只使用受控 fetch，不启动 Worker 或读取模型。 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../config";
import { createImageAiWorkerClient, ImageAiWorkerError } from "../domains/image-ai/worker-client";
import { createChatterboxWorkerClient, ChatterboxWorkerError } from "../domains/speech/chatterbox/worker-client";

function config() {
  return {
    ...getConfig({ dotenvPath: false, environment: { NODE_ENV: "test" } }),
    imageAiWorkerUrl: "http://image.test",
    imageAiWorkerToken: "test-image-token",
    chatterboxWorkerUrl: "http://speech.test",
    chatterboxWorkerToken: "test-speech-token"
  };
}
const generation = {
  text: "test",
  language: "en" as const,
  device: "cpu" as const,
  referencePath: "reference.wav",
  outputPath: "result.wav",
  exaggeration: 0.5,
  cfgWeight: 0.5,
  temperature: 0.8,
  seed: 1
};
const generated = {
  sampleRate: 24000,
  samples: 24000,
  durationSeconds: 1,
  chunks: 1,
  segments: [{ text: "test", startSeconds: 0, endSeconds: 1 }],
  device: "cpu",
  watermarked: true
};
const variants = [
  {
    name: "image",
    prefix: "IMAGE_AI",
    create: createImageAiWorkerClient,
    Error: ImageAiWorkerError,
    timeout: 15000,
    fallback: "AI 推理服务返回 503",
    invalid: "AI Worker 返回了不兼容的数据"
  },
  {
    name: "speech",
    prefix: "CHATTERBOX",
    create: createChatterboxWorkerClient,
    Error: ChatterboxWorkerError,
    timeout: 10000,
    fallback: "Chatterbox Worker 返回 503",
    invalid: "Chatterbox Worker 返回了不兼容的数据"
  }
] as const;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each(variants)("$name Worker transport compatibility", (variant) => {
  it.each([
    {
      payload: { error: { code: "WORKER_CUSTOM", message: "worker detail" } },
      code: "WORKER_CUSTOM",
      message: "worker detail"
    },
    { payload: { detail: "legacy detail" }, message: "legacy detail" },
    { payload: { message: "ignored" } },
    { payload: { error: { code: 42, message: false }, detail: "ignored" } },
    { payload: { error: [], detail: "ignored" } },
    { payload: null },
    { payload: "scalar" }
  ])("preserves failure envelope $payload", async ({ payload, code, message }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 503 }))
    );
    await expect(variant.create(config()).health()).rejects.toMatchObject({
      name: variant.Error.name,
      code: code ?? `${variant.prefix}_WORKER_FAILED`,
      message: message ?? variant.fallback,
      status: 503
    });
  });

  it.each(["not json", JSON.stringify({ success: false }), JSON.stringify({ success: true, data: {} })])(
    "rejects incompatible successful response %s",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(body))
      );
      await expect(variant.create(config()).health()).rejects.toMatchObject({
        code: `${variant.prefix}_WORKER_INVALID_RESPONSE`,
        message: variant.invalid,
        status: 502
      });
    }
  );

  it("uses the existing fallback for non-JSON HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 503 }))
    );
    await expect(variant.create(config()).health()).rejects.toMatchObject({
      code: `${variant.prefix}_WORKER_FAILED`,
      message: variant.fallback,
      status: 503
    });
  });

  it("preserves owned errors but maps network and foreign errors", async () => {
    const own = new variant.Error("OWN", "owned", 409);
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(own)
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(
        variant.name === "image"
          ? new ChatterboxWorkerError("OTHER", "other")
          : new ImageAiWorkerError("OTHER", "other")
      );
    vi.stubGlobal("fetch", fetcher);
    const client = variant.create(config());
    await expect(client.health()).rejects.toBe(own);
    await expect(client.health()).rejects.toMatchObject({ code: `${variant.prefix}_WORKER_UNAVAILABLE` });
    await expect(client.health()).rejects.toMatchObject({ code: `${variant.prefix}_WORKER_UNAVAILABLE` });
  });

  it("keeps health timeout and releases its timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
              once: true
            });
          })
      )
    );
    const failure = variant
      .create(config())
      .health()
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(variant.timeout - 1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await failure).toMatchObject({ code: `${variant.prefix}_WORKER_TIMEOUT` });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Worker abort ownership and generation serialization", () => {
  it.each(["image", "speech"] as const)(
    "%s reads current config and releases listeners after success",
    async (kind) => {
      vi.useFakeTimers();
      const external = new AbortController();
      const add = vi.spyOn(external.signal, "addEventListener");
      const remove = vi.spyOn(external.signal, "removeEventListener");
      const local = config();
      const image = createImageAiWorkerClient(local);
      const speech = createChatterboxWorkerClient(local);
      local.imageAiWorkerUrl = local.chatterboxWorkerUrl = "http://changed.test";
      local.imageAiWorkerToken = local.chatterboxWorkerToken = "changed-test-token";
      const fetcher = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              data: kind === "image" ? { provider: "birefnet-general", model: "test" } : generated
            })
          )
      );
      vi.stubGlobal("fetch", fetcher);
      if (kind === "image")
        await image.process({
          operation: "background_remove",
          inputPath: "in.png",
          outputPath: "out.png",
          signal: external.signal
        });
      else await speech.generate({ ...generation, signal: external.signal });
      const call = vi.mocked(fetch).mock.calls[0];
      expect(String(call[0])).toBe(`http://changed.test/${kind === "image" ? "process" : "generate"}`);
      const headers = new Headers(call[1]!.headers);
      expect(headers.get("x-toolbox-worker-token")).toBe("changed-test-token");
      expect(headers.get("content-type")).toBe("application/json");
      expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it("keeps the image transport's existing pre-aborted-signal behavior", async () => {
    const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
      expect(init.signal!.aborted).toBe(false);
      return new Response(JSON.stringify({ success: true, data: { provider: "birefnet-general", model: "test" } }));
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(
      createImageAiWorkerClient(config()).process({
        operation: "background_remove",
        inputPath: "in.png",
        outputPath: "out.png",
        signal: AbortSignal.abort()
      })
    ).resolves.toMatchObject({ provider: "birefnet-general" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(["image", "speech"] as const)("%s removes the same external abort listener", async (kind) => {
    vi.useFakeTimers();
    const external = new AbortController();
    const add = vi.spyOn(external.signal, "addEventListener");
    const remove = vi.spyOn(external.signal, "removeEventListener");
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let internal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            internal = init.signal;
            init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
              once: true
            });
            started();
          })
      )
    );
    const input = { signal: external.signal };
    const failure = (
      kind === "image"
        ? createImageAiWorkerClient(config()).process({
            ...input,
            operation: "background_remove",
            inputPath: "input.png",
            outputPath: "output.png"
          })
        : createChatterboxWorkerClient(config()).generate({ ...generation, ...input })
    ).catch((error: unknown) => error);
    await ready;
    expect(internal).not.toBe(external.signal);
    external.abort();
    expect(await failure).toMatchObject({
      code: kind === "image" ? "IMAGE_AI_TASK_INTERRUPTED" : "CHATTERBOX_TASK_CANCELLED"
    });
    expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains Chatterbox's pre-abort check without contacting fetch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      createChatterboxWorkerClient(config()).generate({ ...generation, signal: AbortSignal.abort() })
    ).rejects.toMatchObject({ code: "CHATTERBOX_TASK_CANCELLED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serializes different clients at module scope and recovers after a rejected generation", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = vi
      .fn()
      .mockImplementationOnce(async () => {
        await gate;
        throw new TypeError("network");
      })
      .mockImplementation(async () => new Response(JSON.stringify({ success: true, data: generated })));
    vi.stubGlobal("fetch", fetcher);
    const first = createChatterboxWorkerClient(config())
      .generate(generation)
      .catch((error: unknown) => error);
    const second = createChatterboxWorkerClient(config()).generate(generation);
    try {
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
      await Promise.resolve();
      expect(fetcher).toHaveBeenCalledOnce();
    } finally {
      release();
    }
    expect(await first).toMatchObject({ code: "CHATTERBOX_WORKER_UNAVAILABLE" });
    expect(await second).toEqual(generated);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
