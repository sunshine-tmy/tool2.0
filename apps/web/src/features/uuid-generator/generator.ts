/** RFC 9562 UUID v4 generation. Canonical identities stay separate from their display format. */
export const UUID_LIMITS = Object.freeze({ maxCount: 10_000, chunkSize: 256, duplicateRetries: 16 });
export type RandomFill = (bytes: Uint8Array) => void;
export type UuidLayout = "lines" | "comma" | "json";
type UuidFormat = { uppercase: boolean; hyphens: boolean; layout: UuidLayout };
export class UuidGenerationError extends Error {
  constructor(
    readonly code: "count" | "random-unavailable" | "random-failed" | "duplicates",
    message: string
  ) {
    super(message);
  }
}
export function isUuidCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= UUID_LIMITS.maxCount;
}
export const fillSecureRandom: RandomFill = (bytes) => {
  const provider = globalThis.crypto;
  if (!provider || typeof provider.getRandomValues !== "function")
    throw new UuidGenerationError("random-unavailable", "当前浏览器无法使用安全随机数，请更新浏览器后重试");
  try {
    provider.getRandomValues(bytes);
  } catch {
    throw new UuidGenerationError("random-failed", "安全随机数生成失败，请重试");
  }
};
function canonicalUuid(bytes: Uint8Array, offset: number) {
  let hex = "";
  for (let i = 0; i < 16; i++) {
    const byte = bytes[offset + i];
    const value = i === 6 ? (byte & 0x0f) | 0x40 : i === 8 ? (byte & 0x3f) | 0x80 : byte;
    hex += value.toString(16).padStart(2, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function generateUuidChunk(count: number, seen: Set<string>, fill: RandomFill = fillSecureRandom): string[] {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > UUID_LIMITS.chunkSize ||
    seen.size + count > UUID_LIMITS.maxCount
  )
    throw new UuidGenerationError("count", "生成数量需要为 1～10,000 的整数");
  // At most 4096 bytes per native call, below getRandomValues' 65536-byte ceiling.
  const bytes = new Uint8Array(count * 16),
    retry = new Uint8Array(16),
    ids: string[] = [];
  fill(bytes);
  for (let i = 0; i < count; i++) {
    let id = canonicalUuid(bytes, i * 16),
      attempts = 0;
    while (seen.has(id)) {
      if (attempts++ >= UUID_LIMITS.duplicateRetries)
        throw new UuidGenerationError("duplicates", "随机数连续重复，已停止生成，请重试");
      fill(retry);
      id = canonicalUuid(retry, 0);
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
export function formatUuids(ids: readonly string[], settings: UuidFormat): string {
  const values = ids.map((id) => {
    const text = settings.hyphens ? id : id.replaceAll("-", "");
    return settings.uppercase ? text.toUpperCase() : text;
  });
  if (settings.layout === "json") return JSON.stringify(values, null, 2);
  return values.join(settings.layout === "comma" ? "," : "\n");
}
