/** 直接覆盖真实分段/网络解码逻辑，不把固定 Worker 响应误当成模型效果验证。 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../config";
import { translateArchiveSegments } from "../modules/media-archive/translation-engine";
const nativeFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
});
const config = () =>
  getConfig({
    dotenvPath: false,
    environment: { NODE_ENV: "test", DEPLOYMENT_MODE: "local", XHS_TRANSLATION_TOKEN: "local-worker-secret" }
  });
const translate = (provider: string, texts: string[], signal = new AbortController().signal) =>
  translateArchiveSegments(config(), provider, texts, "translating-description", vi.fn(), signal);
describe("翻译执行网关", () => {
  it("长正文按 350 字及句子边界切分，单批不超过 64 段，表情/网址/提及/数字保持原样", async () => {
    const lengths: number[] = [],
      batches: number[] = [];
    globalThis.fetch = vi.fn(async (_input, init) => {
      const texts = JSON.parse(String(init?.body)).texts as string[];
      lengths.push(...texts.map((value) => Array.from(value).length));
      batches.push(texts.length);
      return new Response(JSON.stringify({ translations: texts.map((text) => "Translated:" + text) }));
    }) as typeof fetch;
    const values = await translate("https://provider.test", [
      "中".repeat(60) + "。" + "文".repeat(800),
      "测".repeat(720),
      ...Array(70).fill("中文 @author 2026 https://example.test 😀 [彩虹R]")
    ]);
    expect(values).toHaveLength(72);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(350);
    expect(Math.max(...batches)).toBe(64);
    for (const literal of ["@author", "2026", "https://example.test", "😀", "[彩虹R]"])
      expect(values[2]).toContain(literal);
  });
  it.each(["http://127.0.0.1:9999", "http://[::1]:9999", "https://provider.test", "invalid-provider"])(
    "Worker 令牌只附带本机地址：%s",
    async (provider) => {
      let authorization: string | null = null;
      globalThis.fetch = vi.fn(async (_input, init) => {
        authorization = new Headers(init?.headers).get("x-toolbox-worker-token");
        return new Response(JSON.stringify({ translations: ["English"] }));
      }) as typeof fetch;
      expect(await translate(provider, ["中文"])).toEqual(["English"]);
      expect(authorization).toBe(provider.startsWith("http://") ? "local-worker-secret" : null);
    }
  );
  it.each([{ translations: [] }, { translations: [1] }, { translations: "English" }, { other: true }])(
    "错误 Worker 输出不能成为归档译文：%j",
    async (payload) => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(payload))) as typeof fetch;
      await expect(translate("https://provider.test", ["中文"])).rejects.toThrow("返回结果无效");
    }
  );
  it.each([true, false])("非成功状态保留错误分类，不保存部分结果：%s", async (detail) => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify(detail ? { detail: "Worker unavailable" } : {}), { status: 503 })
    ) as typeof fetch;
    await expect(translate("https://provider.test", ["中文"])).rejects.toThrow("HTTP 503");
  });
  it("无效 JSON 被拒绝；读取挂起时取消能立即结束，不等待迟到结果", async () => {
    globalThis.fetch = vi.fn(async () => new Response("not-json")) as typeof fetch;
    await expect(translate("https://provider.test", ["中文"])).rejects.toThrow("返回结果无效");
    const controller = new AbortController();
    let release!: () => void;
    const reading = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start() {
              release();
            }
          })
        )
    ) as typeof fetch;
    const task = translate("https://provider.test", ["中文"], controller.signal);
    await reading;
    controller.abort(new Error("测试取消"));
    await expect(task).rejects.toThrow("测试取消");
  });
});
