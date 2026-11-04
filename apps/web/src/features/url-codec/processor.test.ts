import { expect, it } from "vitest";
import { measureUrlText, processUrl, URL_CODEC_LIMITS, type UrlSettings } from "./processor";
const defaults: UrlSettings = { direction: "encode", mode: "component" };
const run = (source: string, settings: Partial<UrlSettings> = {}) => processUrl(source, { ...defaults, ...settings });
function success(source: string, settings: Partial<UrlSettings> = {}) {
  const result = run(source, settings);
  if (!result.ok) throw Error(JSON.stringify(result.error));
  return result;
}
it.each([
  ["中文 a+b", "%E4%B8%AD%E6%96%87%20a%2Bb"],
  ["/?&=#:+,;$", "%2F%3F%26%3D%23%3A%2B%2C%3B%24"],
  ["😀", "%F0%9F%98%80"],
  [" !'()*~-._ ", "%20!'()*~-._%20"],
  ["\ufeff\0\r\n\t", "%EF%BB%BF%00%0D%0A%09"],
  ["", ""]
])("encodes and restores exact component vector %j", (source, encoded) => {
  expect(success(source).text).toBe(encoded);
  expect(success(encoded, { direction: "decode" }).text).toBe(source);
});
it("preserves full URI structure and leaves escaped reserved characters intact including their case", () => {
  const source = "https://example.com/中文?q=a b&x=1#片段";
  const encoded = "https://example.com/%E4%B8%AD%E6%96%87?q=a%20b&x=1#%E7%89%87%E6%AE%B5";
  expect(success(source, { mode: "uri" }).text).toBe(encoded);
  expect(success(encoded, { direction: "decode", mode: "uri" }).text).toBe(source);
  const escapes = "%2f%3F%23%26%3D%2B%3A%3B%40%24%2C";
  expect(success(escapes, { direction: "decode", mode: "uri" }).text).toBe(escapes);
  expect(success(escapes, { direction: "decode" }).text).toBe("/?#&=+:;@$,");
});
it("implements form FIELD encoding without parsing pairs, and keeps literal plus distinct from spaces", () => {
  expect(success("a b+c&d=e!~'()*", { mode: "form" }).text).toBe("a+b%2Bc%26d%3De%21%7E%27%28%29*");
  expect(success("a+b%2Bc", { direction: "decode", mode: "form" }).text).toBe("a b+c");
  expect(success("a+b%2Bc", { direction: "decode" }).text).toBe("a+b+c");
  expect(success("a+b%2Bc", { direction: "decode", mode: "uri" }).text).toBe("a+b%2Bc");
  expect(success("q=a+b&x=1", { direction: "decode", mode: "form" }).text).toBe("q=a b&x=1");
});
it("processes one layer and preserves whitespace, BOM and Unicode normalization without opening a URL", () => {
  expect(success("%20").text).toBe("%2520");
  expect(success("%252F", { direction: "decode" }).text).toBe("%2F");
  for (const text of [
    " é ",
    "e\u0301",
    "\ufeff中文",
    "javascript:alert(1)",
    "<img src=x onerror=alert(1)>",
    "\u007f\u0080\u07ff\u0800\ud7ff\ue000\uffff\u{10000}\u{10ffff}"
  ]) {
    for (const mode of ["component", "uri", "form"] as const) {
      const encoded = success(text, { mode });
      expect(success(encoded.text, { mode, direction: "decode" }).text).toBe(text);
    }
  }
});
it.each(["%", "%2", "%GG", "x%Q0", "%E4%G0", "%2\n0"])("rejects malformed percent escape %j", (source) => {
  for (const mode of ["component", "uri", "form"] as const)
    expect(run(source, { direction: "decode", mode })).toMatchObject({
      ok: false,
      error: { code: "escape", offset: source.indexOf("%", source.startsWith("%E4") ? 3 : 0) }
    });
});
it.each([
  "%E4%B8",
  "%E4x",
  "%C2",
  "%F0%9F%98",
  "%FF",
  "%80",
  "%C0%80",
  "%C1%BF",
  "%E0%80%80",
  "%ED%A0%80",
  "%F0%80%80%80",
  "%F4%90%80%80",
  "%F5%80%80%80",
  "%E4%41%AD"
])("rejects invalid UTF-8 without replacing bytes: %j", (source) => {
  for (const mode of ["component", "uri", "form"] as const)
    expect(run(source, { direction: "decode", mode })).toMatchObject({ ok: false, error: { code: "utf8", offset: 0 } });
});
it.each(["\ud800", "\udc00", "x\ud800y"])("refuses lone surrogate %j in both directions", (source) => {
  for (const direction of ["encode", "decode"] as const)
    expect(run(source, { direction })).toMatchObject({ ok: false, error: { code: "unicode" } });
});
it("maps errors to original CRLF/Unicode input before form plus conversion", () => {
  expect(run("😀\r\na+b%GG", { direction: "decode", mode: "form" })).toMatchObject({
    ok: false,
    error: { code: "escape", offset: 7, line: 2, column: 4 }
  });
  expect(run("😀+%FF", { direction: "decode", mode: "form" })).toMatchObject({
    ok: false,
    error: { offset: 3, line: 1, column: 3 }
  });
});
it("enforces UTF-8 input/output limits and reports correct metrics", () => {
  expect(measureUrlText("中😀\ud800")).toEqual({ bytes: 10, characters: 3 });
  expect(success("中文😀")).toMatchObject({ inputBytes: 10, outputBytes: 30, outputChars: 30 });
  expect(success("%E4%B8%AD", { direction: "decode" })).toMatchObject({
    inputBytes: 9,
    outputBytes: 3,
    outputChars: 1
  });
  expect(processUrl("中文", defaults, { inputBytes: 5, outputBytes: 100 })).toMatchObject({
    ok: false,
    error: { code: "limit" }
  });
  expect(processUrl("a b", defaults, { inputBytes: 10, outputBytes: 4 })).toMatchObject({
    ok: false,
    error: { code: "limit" }
  });
  expect(run("a".repeat(URL_CODEC_LIMITS.inputBytes + 1))).toMatchObject({ ok: false, error: { code: "limit" } });
  expect(success(" ".repeat(URL_CODEC_LIMITS.inputBytes)).outputBytes).toBe(URL_CODEC_LIMITS.outputBytes);
});
