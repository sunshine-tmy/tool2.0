import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import {
  safeChildPath,
  isPathWithin,
  isSafeRelativePath,
  isSafeArchivePath
} from "../modules/components/package-paths";

it("rejects roots, siblings and prefix lookalikes without widening the component boundary", () => {
  const root = path.join(os.tmpdir(), "component-path-fixture");
  const child = path.join(root, "versions", "1.0.0");
  expect(isPathWithin(root, child)).toBe(true);
  expect(safeChildPath(root, "versions/1.0.0")).toBe(child);
  for (const target of [root, root + "-other/file", path.dirname(root)]) {
    expect(isPathWithin(root, target)).toBe(false);
    expect(() => safeChildPath(root, target)).toThrow("能力包路径越界");
  }
});
it("preserves strict archive-relative names for both Windows and POSIX", () => {
  for (const candidate of ["", ".", "..", "../a", "a/../b", "a//b", "a\\b", "C:/x", "/x", "a:b", "a/\0"]) {
    expect(isSafeRelativePath(candidate), candidate).toBe(false);
  }
  expect(isSafeRelativePath("模型/file-1.whl")).toBe(true);
});
it("allows a trailing slash for archive directories only", () => {
  expect(isSafeRelativePath("model/")).toBe(false);
  expect(isSafeArchivePath("model/")).toBe(true);
  expect(isSafeArchivePath("/")).toBe(false);
  expect(isSafeArchivePath("../")).toBe(false);
});
