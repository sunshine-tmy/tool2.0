/**
 * 中文模块说明：测试 backend/src/__tests__/archive-safety.test.ts 中的稳定行为、边界条件和回归场景
 */
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateArchiveListing, validateExtractedDirectory } from "../security/archive-safety";

let root = "";

afterEach(async () => {
  if (root) await fsp.rm(root, { recursive: true, force: true });
});

describe("runtime archive safety", () => {
  it("rejects absolute and parent traversal entries before extraction", () => {
    expect(() => validateArchiveListing("runtime/file.bin\n../outside.txt")).toThrow(/越界路径/);
    expect(() => validateArchiveListing("C:/outside.txt")).toThrow(/越界路径/);
  });

  it("enforces the archive entry count limit", () => {
    expect(() => validateArchiveListing("a\nb\nc", { maxEntries: 2, maxBytes: 1024 })).toThrow(/文件数量/);
  });

  it("enforces extracted file count and total bytes", async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-archive-safety-"));
    await fsp.writeFile(path.join(root, "one.bin"), Buffer.alloc(4));
    await fsp.writeFile(path.join(root, "two.bin"), Buffer.alloc(4));

    await expect(validateExtractedDirectory(root, { maxEntries: 1, maxBytes: 1024 })).rejects.toThrow(/文件数量/);
    await expect(validateExtractedDirectory(root, { maxEntries: 10, maxBytes: 7 })).rejects.toThrow(/解压体积/);
  });

  it.skipIf(process.platform === "win32")("rejects symbolic links in extracted trees", async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-archive-safety-"));
    await fsp.writeFile(path.join(root, "outside.txt"), "outside");
    await fsp.symlink(path.join(root, "outside.txt"), path.join(root, "link.txt"));

    await expect(validateExtractedDirectory(root)).rejects.toThrow(/符号链接/);
  });
});
