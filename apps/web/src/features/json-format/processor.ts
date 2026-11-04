/** Strict JSON validation and whitespace formatting without converting values to JS numbers or objects. */
export type JsonIndent = "2" | "4" | "tab";
export type JsonMode = "format" | "minify";
export const JSON_LIMITS = Object.freeze({ inputBytes: 5 * 1024 ** 2, outputBytes: 20 * 1024 ** 2, depth: 256 });
export const JSON_AUTO_BYTES = 200 * 1024;
export type JsonSettings = { indent: JsonIndent; mode: JsonMode };
type Position = { offset: number; line: number; column: number };
export type JsonIssue = Position & { code: "syntax" | "limit" | "internal"; message: string };
type JsonWarning = Position & { message: string };
export type JsonResult =
  | {
      ok: true;
      text: string;
      inputBytes: number;
      outputBytes: number;
      inputChars: number;
      outputChars: number;
      warnings: JsonWarning[];
      warningCount: number;
    }
  | { ok: false; error: JsonIssue };
export type JsonWorkerRequest = JsonSettings & { id: number; text: string };
export type JsonWorkerReply = { id: number; result: JsonResult };

class JsonFailure extends Error {
  constructor(
    readonly code: "syntax" | "limit",
    message: string,
    readonly offset: number
  ) {
    super(message);
  }
}
const encoder = new TextEncoder();
export function countJsonCharacters(text: string) {
  let count = 0;
  for (let i = 0; i < text.length; count++) i += text.codePointAt(i)! > 0xffff ? 2 : 1;
  return count;
}
function positionAt(text: string, offset: number): Position {
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

export function processJson(
  text: string,
  settings: JsonSettings,
  limits: Readonly<Record<"inputBytes" | "outputBytes" | "depth", number>> = JSON_LIMITS
): JsonResult {
  let offset = 0,
    outputBytes = 0,
    outputUnits = 0,
    pending = "",
    warningCount = 0;
  const chunks: string[] = [],
    warnings: JsonWarning[] = [];
  const indent = settings.indent === "tab" ? "\t" : " ".repeat(Number(settings.indent));
  const pretty = settings.mode === "format";
  const error = (message: string, at = offset): never => {
    throw new JsonFailure("syntax", message, at);
  };
  const limit = (message: string): never => {
    throw new JsonFailure("limit", message, offset);
  };
  function warn(message: string, at: number) {
    warningCount++;
    if (warnings.length < 20) warnings.push({ ...positionAt(text, at), message });
  }
  function flush() {
    if (!pending) return;
    outputBytes += encoder.encode(pending).byteLength;
    if (outputBytes > limits.outputBytes) limit("格式化输出超过大小限制，请使用压缩模式或缩小输入");
    chunks.push(pending);
    pending = "";
  }
  function write(value: string) {
    outputUnits += value.length;
    if (outputUnits > limits.outputBytes) limit("格式化输出超过大小限制，请使用压缩模式或缩小输入");
    pending += value;
    if (pending.length >= 16384) flush();
  }
  function whitespace() {
    while (offset < text.length && /[\x20\t\r\n]/.test(text[offset])) offset++;
  }
  function newline(depth: number) {
    if (pretty) write("\n" + indent.repeat(depth));
  }
  function string() {
    const start = offset++;
    while (offset < text.length) {
      const code = text.charCodeAt(offset++);
      if (code === 34) return text.slice(start, offset);
      if (code < 32) error("字符串中不能包含未转义的控制字符或换行", offset - 1);
      if (code !== 92) continue;
      if (offset >= text.length) error("字符串转义不完整");
      const escaped = text[offset++];
      if ('"\\/bfnrt'.includes(escaped)) continue;
      if (escaped !== "u") error("无效的字符串转义", offset - 1);
      for (let i = 0; i < 4; i++) {
        if (offset >= text.length || !/[0-9a-fA-F]/.test(text[offset])) error("Unicode 转义需要四位十六进制数字");
        offset++;
      }
    }
    return error("字符串缺少结束双引号");
  }
  const number = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  function value(depth: number) {
    whitespace();
    const char = text[offset];
    if (char === "{" || char === "[") return collection(depth + 1, char === "{");
    if (char === '"') {
      write(string());
      return;
    }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, offset)) {
        offset += literal.length;
        write(literal);
        return;
      }
    }
    number.lastIndex = offset;
    const match = number.exec(text);
    if (match) {
      offset += match[0].length;
      write(match[0]);
      return;
    }
    error(offset >= text.length ? "内容不完整，需要 JSON 值" : "需要标准 JSON 值：请检查引号、数字或非法内容");
  }
  function collection(depth: number, object: boolean) {
    if (depth > limits.depth) limit(`嵌套超过 ${limits.depth} 层，无法安全处理`);
    const close = object ? "}" : "]",
      keys = object ? new Set<string>() : undefined;
    write(text[offset++]);
    whitespace();
    if (text[offset] === close) {
      offset++;
      write(close);
      return;
    }
    while (true) {
      newline(depth);
      if (object) {
        if (text[offset] !== '"') error("对象字段名必须使用双引号");
        const start = offset,
          raw = string(),
          key: string = JSON.parse(raw);
        if (keys!.has(key))
          warn(`重复字段“${key.length > 60 ? key.slice(0, 60) + "…" : key}”，已保留所有同名字段`, start);
        keys!.add(key);
        write(raw);
        whitespace();
        if (text[offset] !== ":") error("字段名后缺少冒号");
        offset++;
        write(pretty ? ": " : ":");
      }
      value(depth);
      whitespace();
      if (text[offset] === close) {
        offset++;
        newline(depth - 1);
        write(close);
        return;
      }
      if (text[offset] !== ",") error(`缺少逗号或${object ? "右花括号 }" : "右方括号 ]"}`);
      offset++;
      write(",");
      whitespace();
      if (text[offset] === close) error("标准 JSON 不允许尾随逗号");
    }
  }
  try {
    if (text.length > limits.inputBytes) limit("输入超过大小限制，单次最多 5 MiB");
    const inputBytes = encoder.encode(text).byteLength;
    if (inputBytes > limits.inputBytes) limit("输入超过大小限制，单次最多 5 MiB");
    if (text.charCodeAt(0) === 0xfeff) {
      offset++;
      warn("已忽略文件开头的 UTF-8 BOM", 0);
    }
    whitespace();
    value(0);
    whitespace();
    if (offset !== text.length) error("JSON 值后存在多余内容，请检查数字、分隔符或多个根值");
    flush();
    const result = chunks.join("");
    return {
      ok: true,
      text: result,
      inputBytes,
      outputBytes,
      inputChars: countJsonCharacters(text),
      outputChars: countJsonCharacters(result),
      warnings,
      warningCount
    };
  } catch (failure) {
    if (!(failure instanceof JsonFailure)) throw failure;
    return { ok: false, error: { ...positionAt(text, failure.offset), code: failure.code, message: failure.message } };
  }
}
