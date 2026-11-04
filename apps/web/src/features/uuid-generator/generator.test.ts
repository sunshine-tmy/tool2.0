import { afterEach, expect, it, vi } from "vitest";
import {
  fillSecureRandom,
  formatUuids,
  generateUuidChunk,
  isUuidCount,
  UUID_LIMITS,
  UuidGenerationError,
  type RandomFill
} from "./generator";
const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([null, undefined, "5", 0, -1, 1.1, 10_001, NaN, Infinity])(
  "rejects invalid quantity %j without coercion",
  (count) => {
    expect(isUuidCount(count)).toBe(false);
  }
);
it.each([1, 5, 10_000])("accepts quantity boundary %i", (count) => {
  expect(isUuidCount(count)).toBe(true);
});
it.each([
  [0, "00000000-0000-4000-8000-000000000000"],
  [255, "ffffffff-ffff-4fff-bfff-ffffffffffff"],
  [85, "55555555-5555-4555-9555-555555555555"],
  [170, "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"]
])("sets version/variant bits without changing other bytes: %i", (byte, expected) => {
  const ids = generateUuidChunk(1, new Set(), (bytes) => bytes.fill(byte));
  expect(ids).toEqual([expected]);
  expect(ids[0]).toMatch(v4);
});
it("uses the specified network byte order and preserves the supplied entropy buffer", () => {
  let entropy!: Uint8Array;
  const ids = generateUuidChunk(1, new Set(), (bytes) => {
    bytes.set(Buffer.from("00112233445566778899aabbccddeeff", "hex"));
    entropy = bytes;
  });
  expect(ids).toEqual(["00112233-4455-4677-8899-aabbccddeeff"]);
  expect(Buffer.from(entropy).toString("hex")).toBe("00112233445566778899aabbccddeeff");
});
it("works with only getRandomValues on LAN HTTP and preserves the Crypto method receiver", () => {
  const ordinaryRandom = vi.spyOn(Math, "random"),
    provider = {
      getRandomValues(bytes: Uint8Array) {
        expect(this).toBe(provider);
        bytes.fill(255);
        return bytes;
      }
    };
  vi.stubGlobal("crypto", provider);
  expect(generateUuidChunk(1, new Set())).toEqual(["ffffffff-ffff-4fff-bfff-ffffffffffff"]);
  expect(ordinaryRandom).not.toHaveBeenCalled();
});
it("reports missing and failed secure entropy without leaking native errors or falling back", () => {
  vi.stubGlobal("crypto", undefined);
  expect(() => fillSecureRandom(new Uint8Array(16))).toThrow(UuidGenerationError);
  vi.stubGlobal("crypto", { randomUUID: () => "not-used" });
  expect(() => fillSecureRandom(new Uint8Array(16))).toThrow("安全随机数");
  vi.stubGlobal("crypto", {
    getRandomValues() {
      throw Error("sensitive native details");
    }
  });
  try {
    fillSecureRandom(new Uint8Array(16));
    throw Error("expected failure");
  } catch (error) {
    expect(error).toMatchObject({ code: "random-failed", message: "安全随机数生成失败，请重试" });
  }
});
it("regenerates duplicates within a chunk and across earlier chunks", () => {
  const seen = new Set<string>(),
    fill = vi.fn((bytes: Uint8Array) => {
      bytes.fill(fill.mock.calls.length === 1 ? 0 : 1);
    });
  const ids = generateUuidChunk(2, seen, fill);
  expect(new Set(ids).size).toBe(2);
  expect(fill.mock.calls.map(([bytes]) => bytes.byteLength)).toEqual([32, 16]);
  let calls = 0;
  const next = generateUuidChunk(1, seen, (bytes) => bytes.fill(++calls === 1 ? 0 : 2));
  expect(calls).toBe(2);
  expect(seen.size).toBe(3);
  expect(ids).not.toContain(next[0]);
});
it("bounds retries when the random source repeatedly returns the same identity", () => {
  const fill = vi.fn((bytes: Uint8Array) => bytes.fill(0));
  expect(() => generateUuidChunk(2, new Set(), fill)).toThrow("连续重复");
  expect(fill).toHaveBeenCalledTimes(1 + UUID_LIMITS.duplicateRetries);
});
it("generates 10000 unique v4 identities with requests below the native quota", () => {
  let serial = 0;
  const lengths: number[] = [],
    seen = new Set<string>(),
    all: string[] = [];
  const fill: RandomFill = (bytes) => {
    lengths.push(bytes.byteLength);
    for (let i = 0; i < bytes.length; i += 16) {
      new DataView(bytes.buffer).setUint32(i, serial++);
    }
  };
  while (all.length < 10_000)
    all.push(...generateUuidChunk(Math.min(UUID_LIMITS.chunkSize, 10_000 - all.length), seen, fill));
  expect(all).toHaveLength(10_000);
  expect(seen.size).toBe(10_000);
  expect(all.every((id) => v4.test(id))).toBe(true);
  expect(lengths).toHaveLength(40);
  expect(Math.max(...lengths)).toBe(4096);
  const rejected = vi.fn();
  expect(() => generateUuidChunk(1, seen, rejected)).toThrow(UuidGenerationError);
  expect(rejected).not.toHaveBeenCalled();
});
it.each([0, -1, 1.5, 257])("rejects invalid chunk %i before calling crypto", (count) => {
  const fill = vi.fn();
  expect(() => generateUuidChunk(count, new Set(), fill)).toThrow(UuidGenerationError);
  expect(fill).not.toHaveBeenCalled();
});
it("formats the same canonical IDs without mutating them or generating new identities", () => {
  const ids = Object.freeze(["00112233-4455-4677-8899-aabbccddeeff", "ffffffff-ffff-4fff-bfff-ffffffffffff"]);
  expect(formatUuids(ids, { uppercase: false, hyphens: true, layout: "lines" })).toBe(ids.join("\n"));
  expect(formatUuids(ids, { uppercase: true, hyphens: false, layout: "comma" })).toBe(
    ids.map((id) => id.replaceAll("-", "").toUpperCase()).join(",")
  );
  expect(JSON.parse(formatUuids(ids, { uppercase: true, hyphens: true, layout: "json" }))).toEqual(
    ids.map((id) => id.toUpperCase())
  );
  expect(ids[0]).toBe("00112233-4455-4677-8899-aabbccddeeff");
});
