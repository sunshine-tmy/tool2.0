/**
 * 中文模块说明：测试 packages/shared/src/__tests__/api-schema.test.ts 中的稳定行为、边界条件和回归场景
 */
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  ApiHealthSchema,
  FileNameParamsSchema,
  LiveHealthSchema,
  ReadyHealthSchema,
  apiSuccessSchema
} from "../api-schema";
import { Type } from "@sinclair/typebox";

describe("core api schemas", () => {
  it("accepts safe file names and rejects separators or response splitting characters", () => {
    expect(Value.Check(FileNameParamsSchema, { fileName: "report 2026.pdf" })).toBe(true);
    for (const fileName of ["../secret.txt", "folder/file.txt", "bad\r\nheader.txt", ""]) {
      expect(Value.Check(FileNameParamsSchema, { fileName })).toBe(false);
    }
  });

  it("validates live, ready and public API health payloads", () => {
    expect(Value.Check(LiveHealthSchema, { status: "ok" })).toBe(true);
    expect(Value.Check(ReadyHealthSchema, { status: "ready", database: "ok", storage: "ok" })).toBe(true);
    expect(
      Value.Check(ApiHealthSchema, {
        status: "ok",
        name: "toolbox-api",
        deploymentMode: "local",
        videoText: { audioExtractorConfigured: true, transcriberConfigured: false },
        shortVideo: { providerConfigured: true },
        xhsArchive: { providerConfigured: false, translationProviderConfigured: false },
        imageAi: { deploymentUsage: "commercial" },
        edgeTts: { retentionDays: 3 },
        chatterbox: { retentionDays: 3 }
      })
    ).toBe(true);
  });

  it("accepts success envelopes with an optional compatibility message", () => {
    const schema = apiSuccessSchema(Type.Object({ id: Type.String() }));

    expect(
      Value.Check(schema, {
        success: true,
        data: { id: "task-1" },
        requestId: "req-1"
      })
    ).toBe(true);
    expect(
      Value.Check(schema, {
        success: true,
        message: "loaded",
        data: { id: "task-1" },
        requestId: "req-2"
      })
    ).toBe(true);
    expect(Value.Check(schema, { success: true, data: { id: "task-1" } })).toBe(false);
  });
});
