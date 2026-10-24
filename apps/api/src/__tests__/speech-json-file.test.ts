import fsp from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeJsonAtomic } from "../domains/speech/shared/json-file";

afterEach(() => vi.restoreAllMocks());
describe("speech ordinary JSON rename policy", () => {
  it.each([
    [{ text: "商品" }, '{\n  "text": "商品"\n}'],
    [[1, 2], "[\n  1,\n  2\n]"]
  ])("keeps the original temporary name, pretty bytes and operation order (%j)", async (value, serialized) => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const mkdir = vi.spyOn(fsp, "mkdir").mockResolvedValue(undefined);
    const write = vi.spyOn(fsp, "writeFile").mockResolvedValue(undefined);
    const rename = vi.spyOn(fsp, "rename").mockResolvedValue(undefined);
    const target = path.join("synthetic", "file.json");
    const temporary = `${target}.${process.pid}.123.tmp`;
    await writeJsonAtomic(target, value);
    expect(mkdir).toHaveBeenCalledExactlyOnceWith(path.dirname(target), { recursive: true });
    expect(write).toHaveBeenCalledExactlyOnceWith(temporary, serialized, "utf8");
    expect(rename).toHaveBeenCalledExactlyOnceWith(temporary, target);
    expect(mkdir.mock.invocationCallOrder[0]).toBeLessThan(write.mock.invocationCallOrder[0]);
    expect(write.mock.invocationCallOrder[0]).toBeLessThan(rename.mock.invocationCallOrder[0]);
  });
  it.each(["mkdir", "writeFile", "rename"] as const)(
    "preserves %s errors and does not introduce cleanup",
    async (stage) => {
      const error = new Error(`${stage} failed`);
      const mkdir = vi.spyOn(fsp, "mkdir").mockResolvedValue(undefined);
      const write = vi.spyOn(fsp, "writeFile").mockResolvedValue(undefined);
      const rename = vi.spyOn(fsp, "rename").mockResolvedValue(undefined);
      const remove = vi.spyOn(fsp, "rm").mockResolvedValue(undefined);
      if (stage === "mkdir") mkdir.mockRejectedValue(error);
      if (stage === "writeFile") write.mockRejectedValue(error);
      if (stage === "rename") rename.mockRejectedValue(error);
      await expect(writeJsonAtomic("synthetic/file.json", { text: "商品" })).rejects.toBe(error);
      if (stage === "mkdir") expect(write).not.toHaveBeenCalled();
      if (stage !== "rename") expect(rename).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    }
  );
  it("does not write or rename if serialization fails", async () => {
    vi.spyOn(fsp, "mkdir").mockResolvedValue(undefined);
    const write = vi.spyOn(fsp, "writeFile").mockResolvedValue(undefined);
    const rename = vi.spyOn(fsp, "rename").mockResolvedValue(undefined);
    const value: { self?: unknown } = {};
    value.self = value;
    await expect(writeJsonAtomic("synthetic/file.json", value)).rejects.toBeInstanceOf(TypeError);
    expect(write).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });
});
