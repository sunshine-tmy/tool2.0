/** UTF-8 URL text transforms. Input offsets always refer to the original, unmodified source. */
export type UrlSettings = { direction: "encode" | "decode"; mode: "component" | "uri" | "form" };
export const URL_CODEC_LIMITS = Object.freeze({ inputBytes: 1024 ** 2, outputBytes: 3 * 1024 ** 2 });
export const URL_CODEC_AUTO_BYTES = 200 * 1024;
export type UrlIssue = {
  code: "escape" | "utf8" | "unicode" | "limit" | "internal";
  message: string;
  offset: number;
  line: number;
  column: number;
};
export type UrlSuccess = {
  ok: true;
  direction: UrlSettings["direction"];
  text: string;
  inputBytes: number;
  outputBytes: number;
  outputChars: number;
};
export type UrlResult = UrlSuccess | { ok: false; error: UrlIssue };
export type UrlRequest = { id: number; source: string; settings: UrlSettings };
export type UrlReply = { id: number; result: UrlResult };

export function measureUrlText(text: string) {
  let bytes = 0,
    characters = 0;
  for (let i = 0; i < text.length; i++, characters++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return { bytes, characters };
}
class UrlFailure extends Error {
  constructor(
    readonly code: UrlIssue["code"],
    message: string,
    readonly offset = 0
  ) {
    super(message);
  }
}
function position(source: string, offset: number) {
  let line = 1,
    column = 1;
  for (let i = 0; i < offset; i++) {
    const code = source.charCodeAt(i);
    if (code === 13 || code === 10) {
      line++;
      column = 1;
      if (code === 13 && source.charCodeAt(i + 1) === 10 && i + 1 < offset) i++;
    } else {
      column++;
      if (source.codePointAt(i)! > 0xffff && i + 1 < offset) i++;
    }
  }
  return { offset, line, column };
}
function validateUnicode(source: string) {
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = source.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new UrlFailure("unicode", "输入包含孤立的 Unicode 代理字符，无法无损处理", i);
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff)
      throw new UrlFailure("unicode", "输入包含孤立的 Unicode 代理字符，无法无损处理", i);
  }
}
function hex(code: number) {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 70) return code - 55;
  if (code >= 97 && code <= 102) return code - 87;
  return -1;
}
function byte(source: string, offset: number) {
  return (hex(source.charCodeAt(offset + 1)) << 4) | hex(source.charCodeAt(offset + 2));
}
function validateEscapes(source: string) {
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "%") continue;
    if (hex(source.charCodeAt(i + 1)) < 0 || hex(source.charCodeAt(i + 2)) < 0)
      throw new UrlFailure("escape", "百分号后需要两个十六进制字符，例如 %20", i);
    i += 2;
  }
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "%") continue;
    const first = byte(source, i);
    if (first < 0x80) {
      i += 2;
      continue;
    }
    const length =
      first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
    if (!length) throw new UrlFailure("utf8", "百分号编码包含非法 UTF-8 字节，无法无损解码", i);
    for (let part = 1; part < length; part++) {
      const offset = i + part * 3;
      if (source[offset] !== "%") throw new UrlFailure("utf8", "百分号编码的 UTF-8 序列不完整", i);
      const next = byte(source, offset);
      if (
        next < 0x80 ||
        next > 0xbf ||
        (part === 1 &&
          ((first === 0xe0 && next < 0xa0) ||
            (first === 0xed && next > 0x9f) ||
            (first === 0xf0 && next < 0x90) ||
            (first === 0xf4 && next > 0x8f)))
      )
        throw new UrlFailure("utf8", "百分号编码包含非法 UTF-8 序列，无法无损解码", i);
    }
    i += length * 3 - 1;
  }
}
export function processUrl(
  source: string,
  settings: UrlSettings,
  limits: Readonly<Record<"inputBytes" | "outputBytes", number>> = URL_CODEC_LIMITS
): UrlResult {
  try {
    if (source.length > limits.inputBytes) throw new UrlFailure("limit", "输入超过 1 MiB，请缩小内容后处理");
    const inputBytes = measureUrlText(source).bytes;
    if (inputBytes > limits.inputBytes) throw new UrlFailure("limit", "输入超过 1 MiB，请缩小内容后处理");
    validateUnicode(source);
    let text: string;
    if (settings.direction === "encode") {
      text = settings.mode === "uri" ? encodeURI(source) : encodeURIComponent(source);
      if (settings.mode === "form")
        text = text
          .replace(/[!'()~]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase())
          .replace(/%20/g, "+");
    } else {
      validateEscapes(source);
      text =
        settings.mode === "uri"
          ? decodeURI(source)
          : decodeURIComponent(settings.mode === "form" ? source.replace(/\+/g, " ") : source);
    }
    const output = measureUrlText(text);
    if (output.bytes > limits.outputBytes) throw new UrlFailure("limit", "输出超过 3 MiB，已停止处理");
    return {
      ok: true,
      direction: settings.direction,
      text,
      inputBytes,
      outputBytes: output.bytes,
      outputChars: output.characters
    };
  } catch (error) {
    if (!(error instanceof UrlFailure)) throw error;
    return { ok: false, error: { code: error.code, message: error.message, ...position(source, error.offset) } };
  }
}
