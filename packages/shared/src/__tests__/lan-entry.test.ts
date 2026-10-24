import { describe, expect, expectTypeOf, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import * as root from "../index";
import * as lan from "../lan/index";
import * as files from "../lan/lan-file";
import * as notes from "../lan/lan-note";
import * as api from "../lan/lan-transfer-api";
import * as access from "../lan/lan-access";

describe("LAN domain entry", () => {
  it("exposes exactly the existing LAN contracts and references", () => {
    const existing = { ...files, ...notes, ...api, ...access };
    expect(Object.keys(lan).sort()).toEqual(Object.keys(existing).sort());
    for (const [key, value] of Object.entries(existing)) {
      expect(Reflect.get(lan, key)).toBe(value);
      expect(Reflect.get(root, key)).toBe(value);
    }
    expect(lan).not.toHaveProperty("registerSharedSchemaFormats");
  });

  it("preserves record and request type identity without conflating DTO and storage records", () => {
    expectTypeOf<lan.LanFileRecord>().toEqualTypeOf<root.LanFileRecord>();
    expectTypeOf<lan.LanFileRecordDto>().toEqualTypeOf<root.LanFileRecordDto>();
    expectTypeOf<lan.LanUploadSessionInput>().toEqualTypeOf<root.LanUploadSessionInput>();
    expectTypeOf<lan.LanNoteRecord["title"]>().toEqualTypeOf<string | undefined>();
  });

  it("keeps query normalization, classification and note limits unchanged", () => {
    for (const name of ["中文.PDF", "folder/file.tar.gz", "audio.mp3", "README", "a.csv"]) {
      expect(lan.classifyLanFile(name)).toBe(root.classifyLanFile(name));
      expect(lan.getLanFileExtension(name)).toBe(root.getLanFileExtension(name));
    }
    expect(lan.normalizeLanFileQuery({ page: "2", pageSize: "999", sortBy: "name" })).toEqual(
      root.normalizeLanFileQuery({ page: "2", pageSize: "999", sortBy: "name" })
    );
    expect(lan.lanNoteLimits).toBe(root.lanNoteLimits);
  });

  it("preserves request validation and detailed errors including extra fields and invalid chunks", () => {
    for (const sample of [
      { uploadId: "upload-1", index: "0" },
      { uploadId: "upload-1", index: "-1" },
      { uploadId: "../bad", index: "0" },
      { uploadId: "upload-1", index: "0", path: "x" }
    ]) {
      expect(Value.Check(lan.LanChunkParamsSchema, sample)).toBe(Value.Check(root.LanChunkParamsSchema, sample));
      expect([...Value.Errors(lan.LanChunkParamsSchema, sample)]).toEqual([
        ...Value.Errors(root.LanChunkParamsSchema, sample)
      ]);
    }
    expect(Value.Check(lan.LanChunkParamsSchema, { uploadId: "upload-1", index: "0" })).toBe(true);
    expect(Value.Check(lan.LanChunkParamsSchema, { uploadId: "upload-1", index: "-1" })).toBe(false);
    expect(Value.Check(lan.LanChunkParamsSchema, { uploadId: "upload-1", index: 0 })).toBe(false);
  });
});
