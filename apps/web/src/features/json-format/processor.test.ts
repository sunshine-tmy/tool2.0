import { describe, expect, it } from "vitest";
import { JSON_LIMITS, processJson, type JsonIndent, type JsonMode } from "./processor";
const process = (text: string, mode: JsonMode = "format", indent: JsonIndent = "2") =>
  processJson(text, { mode, indent });
function output(text: string, mode: JsonMode = "format", indent: JsonIndent = "2") {
  const result = process(text, mode, indent);
  if (!result.ok) throw Error(JSON.stringify(result.error));
  return result;
}
describe("JSON whitespace processor", () => {
  it("formats objects and arrays with 2/4 spaces or tabs and minifies without altering string whitespace", () => {
    expect(output('{"a":[1,{"b":"x y"}],"empty":{}}').text).toBe(
      '{\n  "a": [\n    1,\n    {\n      "b": "x y"\n    }\n  ],\n  "empty": {}\n}'
    );
    expect(output('{"a":1}', "format", "4").text).toBe('{\n    "a": 1\n}');
    expect(output('{"a":1}', "format", "tab").text).toBe('{\n\t"a": 1\n}');
    expect(output(' \r\n { "a" : " x  y ", "b" : [ true, null, false ] } ', "minify").text).toBe(
      '{"a":" x  y ","b":[true,null,false]}'
    );
  });
  it("preserves large numbers, numeric spelling, negative zero, escaped text and lexical property order", () => {
    const text = String.raw`{"9":9007199254740993,"1":123456789012345678901234567890,"n":1.2300,"e":1e+400,"z":-0,"s":"\u4e2d\n\/\\\""}`;
    expect(output(text, "minify").text).toBe(text);
    expect(output(output(text).text, "minify").text).toBe(text);
  });
  it.each(['"中文😀"', "0", "-0", "1e-2", "true", "false", "null", "[]", "{}"])(
    "accepts a scalar or empty collection: %s",
    (text) => {
      expect(output(text).text).toBe(text);
    }
  );
  it("recognizes escaped duplicate keys in the same object, retains them and bounds warnings", () => {
    const result = output('{"a":1,"\\u0061":2,"nested":{"a":3},"A":4}');
    expect(result.warningCount).toBe(1);
    expect(result.warnings[0]).toMatchObject({ line: 1, column: 8, offset: 7 });
    expect(result.text).toContain('"\\u0061": 2');
    expect(output("{" + Array.from({ length: 30 }, () => '"x":1').join(",") + "}").warnings).toHaveLength(20);
  });
  it.each([
    "",
    " ",
    "[1,]",
    '{"x":1,}',
    "{'x':1}",
    "//x\n{}",
    '{"x":undefined}',
    "NaN",
    "Infinity",
    "01",
    "-01",
    "+1",
    "1.",
    "1e",
    "1e+",
    "true false",
    "[1 2]",
    '{"a" 1}',
    "{",
    "[",
    '"a\nb"',
    '"\\x00"',
    '"\\u123x"',
    '"abc',
    '"abc\\'
  ])("rejects invalid JSON: %j", (text) => {
    expect(process(text)).toMatchObject({ ok: false, error: { code: "syntax" } });
  });
  it("locates errors with CRLF, CR and Unicode, using an offset suitable for textarea selection", () => {
    const text = '{\r\n"😀": 1,\r"x": ]}';
    expect(process(text)).toMatchObject({ ok: false, error: { line: 3, column: 6, offset: text.indexOf("]") } });
    expect(process('["😀",?]')).toMatchObject({ ok: false, error: { line: 1, column: 6, offset: 6 } });
  });
  it("normalizes only a leading BOM and reports it without treating BOM elsewhere as whitespace", () => {
    const result = output('\ufeff{"a":1}', "minify");
    expect(result.text).toBe('{"a":1}');
    expect(result.warnings[0].message).toContain("BOM");
    expect(process("{}\ufeff")).toMatchObject({ ok: false });
  });
  it("enforces UTF-8 byte size, nesting and output expansion with distinct resource errors", () => {
    expect(
      processJson('"中文中文"', { mode: "format", indent: "2" }, { ...JSON_LIMITS, inputBytes: 10 })
    ).toMatchObject({ ok: false, error: { code: "limit" } });
    expect(processJson("[[[0]]]", { mode: "format", indent: "2" }, { ...JSON_LIMITS, depth: 2 })).toMatchObject({
      ok: false,
      error: { code: "limit" }
    });
    expect(process("[".repeat(256) + "0" + "]".repeat(256))).toMatchObject({ ok: true });
    expect(process("[".repeat(257) + "0" + "]".repeat(257))).toMatchObject({ ok: false, error: { code: "limit" } });
    expect(
      processJson('["中文",1]', { mode: "format", indent: "4" }, { ...JSON_LIMITS, outputBytes: 16 })
    ).toMatchObject({ ok: false, error: { code: "limit" } });
    expect(
      processJson('["中文",1]', { mode: "minify", indent: "4" }, { ...JSON_LIMITS, outputBytes: 16 })
    ).toMatchObject({ ok: true });
    expect(process('"' + "x".repeat(JSON_LIMITS.inputBytes) + '"')).toMatchObject({
      ok: false,
      error: { code: "limit" }
    });
  });
  it("counts Unicode characters and actual UTF-8 output bytes", () => {
    const result = output('"中😀"');
    expect(result.inputChars).toBe(4);
    expect(result.outputBytes).toBe(9);
    expect(result.inputBytes).toBe(9);
  });
  it("matches native JSON acceptance for generated ordinary values and round trips each mode", () => {
    for (let i = 0; i < 100; i++) {
      const value = { [String(i)]: [null, i * -0.0125, '汉字😀\n"\\', Boolean(i % 2), { nested: [] }] };
      const source = JSON.stringify(value);
      for (const indent of ["2", "4", "tab"] as const) {
        expect(JSON.parse(output(source, "format", indent).text)).toEqual(JSON.parse(source));
        expect(output(output(source, "format", indent).text, "minify").text).toBe(source);
      }
    }
  });
});
