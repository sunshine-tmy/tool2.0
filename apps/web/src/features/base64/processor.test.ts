import { expect, it } from "vitest";
import {
  BASE64_LIMITS,
  processBase64,
  countBase64Characters,
  type Base64Settings,
  type Base64Input
} from "./processor";
const defaults: Base64Settings = { direction: "encode", alphabet: "standard", ignoreWhitespace: true };
const run = (text: string, settings: Partial<Base64Settings> = {}) =>
  processBase64({ kind: "text", text }, { ...defaults, ...settings });
function success(input: string | ArrayBuffer, settings: Partial<Base64Settings> = {}) {
  const result = processBase64(
    typeof input === "string" ? { kind: "text", text: input } : { kind: "file", buffer: input },
    { ...defaults, ...settings }
  );
  if (!result.ok) throw Error(JSON.stringify(result.error));
  return result;
}
it.each([
  ["", ""],
  ["f", "Zg=="],
  ["fo", "Zm8="],
  ["foo", "Zm9v"],
  ["foob", "Zm9vYg=="],
  ["fooba", "Zm9vYmE="],
  ["foobar", "Zm9vYmFy"]
])("matches RFC 4648 vector %j", (text, encoded) => {
  expect(success(text)).toMatchObject({ text: encoded, outputBytes: encoded.length });
  expect(success(encoded, { direction: "decode" })).toMatchObject({ kind: "text", text, outputBytes: text.length });
});
it.each(["中文😀", "\ufeff中文", " x \r\n\t ", "\0\u0001", "é", "e\u0301"])(
  "preserves UTF-8 including whitespace, BOM, controls and normalization: %j",
  (text) => {
    const encoded = success(text);
    expect(encoded.kind === "text" && encoded.text).toBe(Buffer.from(text).toString("base64"));
    const decoded = success(Buffer.from(text).toString("base64"), { direction: "decode" });
    expect(decoded).toMatchObject({ kind: "text", text });
    if (decoded.direction !== "decode") throw Error("expected decoded result");
    expect(Buffer.from(decoded.buffer)).toEqual(Buffer.from(text));
  }
);
it("handles arbitrary bytes and both alphabets without mutating input or forcing binary into UTF-8", () => {
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i),
    before = bytes.slice();
  const encoded = success(bytes.buffer);
  expect(encoded.kind === "text" && encoded.text).toBe(Buffer.from(bytes).toString("base64"));
  expect(bytes).toEqual(before);
  const binary = success(Buffer.from(bytes).toString("base64"), { direction: "decode" });
  expect(binary.kind).toBe("binary");
  if (binary.direction !== "decode") throw Error("expected decoded result");
  expect(new Uint8Array(binary.buffer)).toEqual(bytes);
  expect(success(new Uint8Array([251, 255, 239]).buffer, { alphabet: "url" })).toMatchObject({ text: "-__v" });
  expect(success("_w", { direction: "decode", alphabet: "url" })).toMatchObject({ kind: "binary", warnings: [] });
});
it("accepts correct optional padding and explicitly selected whitespace compatibility", () => {
  expect(success("Zg", { direction: "decode" })).toMatchObject({
    text: "f",
    warnings: [expect.stringContaining("补齐")]
  });
  expect(success("Zg", { direction: "decode", alphabet: "url" })).toMatchObject({ text: "f", warnings: [] });
  expect(success("Zg==", { direction: "decode", alphabet: "url" })).toMatchObject({ text: "f" });
  expect(success(" \tZg=\r\n= ", { direction: "decode" })).toMatchObject({
    text: "f",
    warnings: [expect.stringContaining("ASCII")]
  });
  expect(run(" Zg==", { direction: "decode", ignoreWhitespace: false })).toMatchObject({
    ok: false,
    error: { code: "base64", offset: 0 }
  });
});
it.each([
  "A",
  "AA=",
  "AAAA=",
  "=AAA",
  "Zg===",
  "Zg==x",
  "Zh==",
  "Zm9=",
  "Zm9",
  "?",
  "Zg==\u00a0",
  "\ufeffZg==",
  "data:text/plain;base64,Zg==",
  "%5Ag=="
])("rejects invalid/noncanonical input %j", (text) => {
  expect(run(text, { direction: "decode" })).toMatchObject({ ok: false, error: { code: "base64" } });
});
it("rejects mixed alphabets and preserves coordinates in the original wrapped input", () => {
  expect(run("____", { direction: "decode" })).toMatchObject({
    ok: false,
    error: { message: expect.stringContaining("类型") }
  });
  expect(run("////", { direction: "decode", alphabet: "url" })).toMatchObject({ ok: false });
  expect(run("\r\nZg?", { direction: "decode" })).toMatchObject({
    ok: false,
    error: { offset: 4, line: 2, column: 3 }
  });
});
it.each(["\ud800", "\udc00", "a\r\n\ud800x"])(
  "refuses lone UTF-16 surrogates instead of replacing them: %j",
  (text) => {
    expect(run(text)).toMatchObject({ ok: false, error: { code: "text" } });
  }
);
it("checks input, UTF-8 bytes and predicted output bounds before allocating decoded bytes", () => {
  const input: Base64Input = { kind: "text", text: "中文" };
  expect(processBase64(input, defaults, { payloadBytes: 5, encodedBytes: 7 })).toMatchObject({
    ok: false,
    error: { code: "limit" }
  });
  expect(
    processBase64({ kind: "file", buffer: new ArrayBuffer(6) }, defaults, { payloadBytes: 5, encodedBytes: 7 })
  ).toMatchObject({ ok: false });
  expect(processBase64({ kind: "text", text: "abcd" }, defaults, { payloadBytes: 10, encodedBytes: 7 })).toMatchObject({
    ok: false
  });
  expect(
    processBase64(
      { kind: "text", text: "AAAAAAAA" },
      { ...defaults, direction: "decode" },
      { payloadBytes: 5, encodedBytes: 8 }
    )
  ).toMatchObject({ ok: false, error: { code: "limit" } });
  expect(run("A".repeat(BASE64_LIMITS.encodedBytes + 1), { direction: "decode" })).toMatchObject({
    ok: false,
    error: { code: "limit" }
  });
  expect(run("a".repeat(BASE64_LIMITS.payloadBytes + 1))).toMatchObject({ ok: false, error: { code: "limit" } });
  expect(
    processBase64({ kind: "file", buffer: new ArrayBuffer(0) }, { ...defaults, direction: "decode" })
  ).toMatchObject({ ok: false });
});
it("round trips block boundaries and compares output with an independent platform encoder", () => {
  for (const length of [0, 1, 2, 3, 16383, 16384, 16385, 65537]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 73 + 19) % 256);
    for (const alphabet of ["standard", "url"] as const) {
      const encoded = success(bytes.buffer, { alphabet });
      if (encoded.kind !== "text") throw Error("expected text result");
      expect(encoded.text).toBe(Buffer.from(bytes).toString(alphabet === "url" ? "base64url" : "base64"));
      const decoded = success(encoded.text, { direction: "decode", alphabet });
      if (decoded.direction !== "decode") throw Error("expected bytes");
      expect(new Uint8Array(decoded.buffer)).toEqual(bytes);
    }
  }
  expect(countBase64Characters("中😀")).toBe(2);
});
