/** 翻译执行网关：受保护文本不发给模型，分段有界，Worker 请求与读取均传播取消信号。 */
import type { XhsTranslationTaskStage } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { workerAuthHeaders } from "../../security/worker-auth";
import { abortable } from "./provider";
const HAN = /[\u3400-\u9fff]/u;
export async function translateArchiveSegments(
  config: AppConfig,
  provider: string,
  segments: string[],
  stage: XhsTranslationTaskStage,
  onStage: (stage: XhsTranslationTaskStage, message: string) => void,
  shutdown: AbortSignal
) {
  const result: string[] = [];
  const pending: string[] = [];
  const translations: string[] = [];
  const plans = new Map<number, TranslationPlanPart[][]>();
  segments.forEach((segment, index) => {
    if (!HAN.test(segment)) result[index] = segment;
    else {
      const chunks = splitTranslationSegment(segment);
      plans.set(
        index,
        chunks.map((chunk) =>
          splitProtectedTranslationText(chunk).map((part): TranslationPlanPart => {
            if (part.protected || !HAN.test(part.value)) return { kind: "literal", value: part.value };
            const pendingIndex = pending.length;
            pending.push(part.value);
            return { kind: "translated", pendingIndex };
          })
        )
      );
    }
  });
  if (pending.length) {
    onStage(
      stage,
      stage === "translating-title" ? "正在翻译标题" : stage === "translating-topics" ? "正在翻译话题" : "正在翻译正文"
    );
    for (let offset = 0; offset < pending.length; offset += 64) {
      translations.push(
        ...(await translateProviderBatch(config, provider, pending.slice(offset, offset + 64), shutdown))
      );
    }
  }
  plans.forEach((chunks, index) => {
    result[index] = chunks
      .map((parts) =>
        joinTranslationParts(
          parts.map((part) => (part.kind === "literal" ? part.value : translations[part.pendingIndex]))
        )
      )
      .filter(Boolean)
      .join(" ");
  });
  return result;
}

function splitTranslationSegment(value: string): string[] {
  if (Array.from(value).length <= 350) return [value];
  const chunks: string[] = [];
  let remaining = value;
  while (remaining) {
    const chars = Array.from(remaining);
    if (chars.length <= 350) {
      chunks.push(remaining);
      break;
    }
    const window = chars.slice(0, 350).join("");
    const boundary = Math.max(
      window.lastIndexOf("。"),
      window.lastIndexOf("！"),
      window.lastIndexOf("？"),
      window.lastIndexOf("\n")
    );
    const length = boundary > 40 ? boundary + 1 : 350;
    chunks.push(chars.slice(0, length).join(""));
    remaining = chars.slice(length).join("");
  }
  return chunks;
}

type TranslationPlanPart = { kind: "literal"; value: string } | { kind: "translated"; pendingIndex: number };

function splitProtectedTranslationText(value: string): Array<{ value: string; protected: boolean }> {
  const pattern =
    /https?:\/\/[^\s]+|\[[^\]\r\n]+R\]|@[\p{L}\p{N}_-]+|\d+(?:[.,:/-]\d+)*|[A-Za-z][A-Za-z0-9._-]*|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu;
  const parts: Array<{ value: string; protected: boolean }> = [];
  let offset = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) parts.push({ value: value.slice(offset, index), protected: false });
    parts.push({ value: match[0], protected: true });
    offset = index + match[0].length;
  }
  if (offset < value.length) parts.push({ value: value.slice(offset), protected: false });
  return parts.length ? parts : [{ value, protected: false }];
}

function joinTranslationParts(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim())
    .join(" ")
    .replace(/\s+([,.;:!?，。！？；：])/gu, "$1")
    .replace(/([（([])\s+/gu, "$1")
    .replace(/\s+([）)\]])/gu, "$1")
    .trim();
}

async function translateProviderBatch(
  config: AppConfig,
  provider: string,
  texts: string[],
  shutdown: AbortSignal
): Promise<string[]> {
  const signal = AbortSignal.any([shutdown, AbortSignal.timeout(120_000)]);
  const response = await abortable(
    fetch(`${provider}/translate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...workerAuthHeaders(isLoopbackProvider(provider) ? config.xhsTranslationToken : undefined)
      },
      body: JSON.stringify({ texts }),
      signal
    }),
    signal
  );
  const payload = (await abortable(
    response.json().catch(() => ({})),
    signal
  )) as { translations?: unknown; detail?: unknown };
  if (!response.ok) {
    const detail = typeof payload.detail === "string" ? payload.detail : "本地翻译服务执行失败";
    throw new Error(`${detail}（HTTP ${response.status}）`);
  }
  if (
    !Array.isArray(payload.translations) ||
    payload.translations.length !== texts.length ||
    payload.translations.some((value) => typeof value !== "string")
  )
    throw new Error("本地翻译服务返回结果无效");
  return payload.translations as string[];
}

function isLoopbackProvider(value: string) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}
