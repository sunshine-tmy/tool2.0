import { describe, expect, it } from "vitest";
import { formatBytesAdaptive, formatBytesThroughGb } from "./format-bytes";

const values = [0, 1, 1023, 1024, 1536, 10240, 1024 ** 2, 1024 ** 3, 1024 ** 4, -1, Number.NaN, Infinity];
describe("existing byte presentation policies", () => {
  it("preserves adaptive precision and the TB unit ceiling", () => {
    expect(values.map(formatBytesAdaptive)).toEqual([
      "0 B",
      "1 B",
      "1023 B",
      "1.00 KB",
      "1.50 KB",
      "10.0 KB",
      "1.00 MB",
      "1.00 GB",
      "1.00 TB",
      "-1 B",
      "NaN KB",
      "Infinity TB"
    ]);
  });
  it("preserves fixed decimal precision without adding a TB unit", () => {
    expect(values.map(formatBytesThroughGb)).toEqual([
      "0 B",
      "1 B",
      "1023 B",
      "1.0 KB",
      "1.5 KB",
      "10.0 KB",
      "1.0 MB",
      "1.0 GB",
      "1024.0 GB",
      "-1 B",
      "NaN GB",
      "Infinity GB"
    ]);
  });
  it("does not silently normalize the two existing display policies", () => {
    expect(formatBytesAdaptive(1536)).not.toBe(formatBytesThroughGb(1536));
    expect(formatBytesAdaptive(1024 ** 4)).not.toBe(formatBytesThroughGb(1024 ** 4));
  });
});
