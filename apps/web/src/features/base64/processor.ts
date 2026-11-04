/** Byte-oriented Base64 codec. Text is explicitly UTF-8; decoded binary is never replaced with lossy text. */
export type Base64Settings = {
  direction: "encode" | "decode";
  alphabet: "standard" | "url";
  ignoreWhitespace: boolean;
};
export type Base64Input = { kind: "text"; text: string } | { kind: "file"; buffer: ArrayBuffer };
export const BASE64_LIMITS = Object.freeze({ payloadBytes: 5 * 1024 ** 2, encodedBytes: 7 * 1024 ** 2 });
export const BASE64_AUTO_BYTES = 200 * 1024;
export type Base64Issue = {
  code: "text" | "base64" | "limit" | "internal";
  message: string;
  offset: number;
  line: number;
  column: number;
};
type SuccessInfo = { ok: true; inputBytes: number; outputBytes: number; warnings: string[] };
export type Base64Success = SuccessInfo &
  (
    | { direction: "encode"; kind: "text"; text: string }
    | { direction: "decode"; kind: "text"; text: string; buffer: ArrayBuffer }
    | { direction: "decode"; kind: "binary"; buffer: ArrayBuffer }
  );
export type Base64Result = Base64Success | { ok: false; error: Base64Issue };
export type Base64Request = { id: number; input: Base64Input; settings: Base64Settings };
export type Base64Reply = { id: number; result: Base64Result };
const standard = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const urlSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const encoder = new TextEncoder();
class CodecFailure extends Error {
  constructor(
    readonly code: Base64Issue["code"],
    message: string,
    readonly offset = 0
  ) {
    super(message);
  }
}
export function countBase64Characters(text: string) {
  let count = 0;
  for (let i = 0; i < text.length; count++) i += text.codePointAt(i)! > 0xffff ? 2 : 1;
  return count;
}
function position(text: string, offset: number) {
  let line = 1,
    column = 1;
  for (let i = 0; i < offset; i++) {
    const code = text.charCodeAt(i);
    if (code === 13 || code === 10) {
      line++;
      column = 1;
      if (code === 13 && text.charCodeAt(i + 1) === 10 && i + 1 < offset) i++;
    } else {
      column++;
      if (
        code >= 0xd800 &&
        code <= 0xdbff &&
        text.charCodeAt(i + 1) >= 0xdc00 &&
        text.charCodeAt(i + 1) <= 0xdfff &&
        i + 1 < offset
      )
        i++;
    }
  }
  return { offset, line, column };
}
function ensureUnicode(text: string) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new CodecFailure("text", "输入包含孤立的 Unicode 代理字符，无法无损编码", i);
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff)
      throw new CodecFailure("text", "输入包含孤立的 Unicode 代理字符，无法无损编码", i);
  }
}
const whitespace = (code: number) => code === 32 || code === 9 || code === 13 || code === 10;
function encode(bytes: Uint8Array, alphabet: string, padded: boolean) {
  const chunks: string[] = [];
  let part = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i],
      b = bytes[i + 1] ?? 0,
      c = bytes[i + 2] ?? 0;
    part += alphabet[a >>> 2] + alphabet[((a & 3) << 4) | (b >>> 4)];
    if (i + 1 < bytes.length) part += alphabet[((b & 15) << 2) | (c >>> 6)];
    else if (padded) part += "=";
    if (i + 2 < bytes.length) part += alphabet[c & 63];
    else if (padded) part += "=";
    if (part.length >= 16384) {
      chunks.push(part);
      part = "";
    }
  }
  chunks.push(part);
  return chunks.join("");
}

export function processBase64(
  input: Base64Input,
  settings: Base64Settings,
  limits: Readonly<Record<"payloadBytes" | "encodedBytes", number>> = BASE64_LIMITS
): Base64Result {
  try {
    if (settings.direction === "encode") {
      let bytes: Uint8Array;
      if (input.kind === "file") bytes = new Uint8Array(input.buffer);
      else {
        if (input.text.length > limits.payloadBytes) throw new CodecFailure("limit", "编码输入超过 5 MiB");
        ensureUnicode(input.text);
        bytes = encoder.encode(input.text);
      }
      if (bytes.byteLength > limits.payloadBytes) throw new CodecFailure("limit", "编码输入超过 5 MiB");
      if (4 * Math.ceil(bytes.byteLength / 3) > limits.encodedBytes)
        throw new CodecFailure("limit", "编码结果超过大小限制");
      const text = encode(bytes, settings.alphabet === "url" ? urlSafe : standard, settings.alphabet === "standard");
      return {
        ok: true,
        direction: "encode",
        kind: "text",
        text,
        inputBytes: bytes.byteLength,
        outputBytes: text.length,
        warnings: []
      };
    }
    if (input.kind !== "text") throw new CodecFailure("base64", "解码需要 Base64 文本，请导入 UTF-8 文本文件");
    const text = input.text;
    if (text.length > limits.encodedBytes) throw new CodecFailure("limit", "解码输入超过 7 MiB");
    const alphabet = settings.alphabet === "url" ? urlSafe : standard;
    const table = new Int16Array(128).fill(-1);
    for (let i = 0; i < alphabet.length; i++) table[alphabet.charCodeAt(i)] = i;
    let symbols = 0,
      pads = 0,
      spaces = 0,
      last = 0,
      lastOffset = 0,
      padOffset = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (whitespace(code) && settings.ignoreWhitespace) {
        spaces++;
        continue;
      }
      if (code === 61) {
        if (!pads) padOffset = i;
        if (++pads > 2) throw new CodecFailure("base64", "末尾最多只能有两个填充符 =", i);
        continue;
      }
      if (pads) throw new CodecFailure("base64", "填充符 = 只能位于 Base64 内容末尾", i);
      if (code >= 128 || table[code] < 0) {
        const variant = "+/-_".includes(text[i]);
        throw new CodecFailure(
          "base64",
          variant
            ? "字符与所选 Base64 类型不一致，请检查标准 / URL 安全选项"
            : `Base64 包含非法字符（U+${code.toString(16).toUpperCase().padStart(4, "0")}）`,
          i
        );
      }
      last = table[code];
      lastOffset = i;
      symbols++;
    }
    const remainder = symbols % 4;
    if (remainder === 1) throw new CodecFailure("base64", "Base64 长度不合法：有效字符数不能除以 4 余 1", lastOffset);
    const missing = (4 - remainder) % 4;
    if (pads && (pads !== missing || !symbols))
      throw new CodecFailure("base64", "末尾填充符 = 的数量或位置不合法", padOffset);
    if ((remainder === 2 && last & 15) || (remainder === 3 && last & 3))
      throw new CodecFailure("base64", "Base64 尾部填充位不合法，请核对最后的字符", lastOffset);
    const size = Math.floor((symbols * 6) / 8);
    if (size > limits.payloadBytes) throw new CodecFailure("limit", "解码结果超过 5 MiB，已停止处理");
    const bytes = new Uint8Array(size);
    let bits = 0,
      value = 0,
      index = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code === 61 || whitespace(code)) continue;
      value = (value << 6) | table[code];
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes[index++] = (value >>> bits) & 255;
        value &= (1 << bits) - 1;
      }
    }
    const warnings: string[] = [];
    if (spaces) warnings.push(`已忽略 ${spaces} 个 ASCII 空格、Tab 或换行字符`);
    if (!pads && missing && settings.alphabet === "standard")
      warnings.push(`末尾省略了 ${missing} 个 =，已按兼容规则补齐`);
    const info: SuccessInfo = { ok: true, inputBytes: text.length, outputBytes: size, warnings };
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      return { ...info, direction: "decode", kind: "text", text: decoded, buffer: bytes.buffer };
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return { ...info, direction: "decode", kind: "binary", buffer: bytes.buffer };
    }
  } catch (error) {
    if (!(error instanceof CodecFailure)) throw error;
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...position(input.kind === "text" ? input.text : "", error.offset)
      }
    };
  }
}
