import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { ApiHealthSchema, FileNameParamsSchema, LiveHealthSchema, ReadyHealthSchema } from "../api-schema";

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
});
