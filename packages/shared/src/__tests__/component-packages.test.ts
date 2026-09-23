/** 中文模块说明：验证能力目录状态和异步作业的共享接口契约。 */
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { ComponentJobIdParamsSchema, ComponentJobSchema, ComponentPackageStatusSchema } from "../component-packages";

const packageStatus = {
  id: "edge-tts",
  moduleId: "edge-tts",
  displayName: "在线自然配音",
  groupId: "audio",
  purpose: "生成联网语音",
  dependencyIds: ["python-311"],
  dependentIds: [],
  installConditions: ["需要联网"],
  version: "1.0.0",
  platform: "win32-x64",
  downloadBytes: 1024,
  installedBytes: 4096,
  installed: false,
  state: "blocked",
  health: "unknown",
  licenseName: "MIT",
  licenseUrl: "https://example.test/license",
  blockedReason: "缺少依赖：python-311"
} as const;

describe("component package contracts", () => {
  it("validates the visible capability state while rejecting untrusted transport fields", () => {
    expect(
      Value.Check(ComponentPackageStatusSchema, packageStatus),
      JSON.stringify([...Value.Errors(ComponentPackageStatusSchema, packageStatus)])
    ).toBe(true);
    expect(
      Value.Check(ComponentPackageStatusSchema, {
        ...packageStatus,
        archiveUrl: "https://attacker.example/package.tar.gz"
      })
    ).toBe(false);
    expect(Value.Check(ComponentPackageStatusSchema, { ...packageStatus, state: "available" })).toBe(false);
  });

  it("validates progress jobs and UUID job routes", () => {
    const job = {
      id: "019c6e27-e55b-73d1-87d8-4e01f1f75043",
      componentId: "edge-tts",
      operation: "install",
      state: "running",
      phase: "downloading",
      progress: {
        downloadedBytes: 512,
        totalDownloadBytes: 1024,
        processedFiles: 0,
        totalFiles: 3,
        percentage: 50
      },
      createdAt: "2026-09-24T00:00:00.000Z",
      updatedAt: "2026-09-24T00:00:01.000Z"
    };
    expect(Value.Check(ComponentJobSchema, job), JSON.stringify([...Value.Errors(ComponentJobSchema, job)])).toBe(true);
    expect(Value.Check(ComponentJobIdParamsSchema, { jobId: job.id })).toBe(true);
    expect(Value.Check(ComponentJobIdParamsSchema, { jobId: "not-a-uuid" })).toBe(false);
    expect(Value.Check(ComponentJobSchema, { ...job, progress: { ...job.progress, percentage: 101 } })).toBe(false);
  });
});
