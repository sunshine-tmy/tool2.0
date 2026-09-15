/**
 * 中文模块说明：测试 frontend/src/modules/lan-transfer/upload-resume.test.ts 中的稳定行为、边界条件和回归场景
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fileFingerprint,
  findPendingUpload,
  listPendingUploads,
  removePendingUpload,
  savePendingUpload
} from "./upload-resume";

describe("LAN upload resume registry", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("matches a reselected file to its persisted server session", () => {
    const file = new File(["hello"], "resume.txt", { type: "text/plain", lastModified: 123 });

    savePendingUpload(file, "upload-1");

    expect(findPendingUpload(file)).toMatchObject({
      uploadId: "upload-1",
      fingerprint: fileFingerprint(file),
      size: 5
    });
    removePendingUpload("upload-1");
    expect(listPendingUploads()).toEqual([]);
  });
});
