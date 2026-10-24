import { describe, expect, expectTypeOf, it } from "vitest";
import { ApiFailureSchema, type LanFileList, type LanFileRecord } from "@toolbox/shared";
import { lanFailureResponses, type LanFileListResponse } from "../domains/lan-transfer/route-contract";

// Keep the pre-refactor wire shape as an independent type oracle, not another production DTO.
type OriginalListResponse = {
  files: Array<LanFileRecord & { previewUrl: string; downloadUrl: string }>;
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
};
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];

describe("LAN route response contract", () => {
  it("matches the existing schema-derived list in both directions without changing required fields", () => {
    expectTypeOf<LanFileListResponse>().toMatchTypeOf<OriginalListResponse>();
    expectTypeOf<OriginalListResponse>().toMatchTypeOf<LanFileListResponse>();
    expectTypeOf<LanFileListResponse>().toMatchTypeOf<LanFileList>();
    expectTypeOf<LanFileList>().toMatchTypeOf<LanFileListResponse>();
    expectTypeOf<keyof LanFileListResponse>().toEqualTypeOf<keyof OriginalListResponse>();
    expectTypeOf<RequiredKeys<LanFileListResponse>>().toEqualTypeOf<RequiredKeys<OriginalListResponse>>();
    expectTypeOf<keyof LanFileListResponse["files"][number]>().toEqualTypeOf<
      keyof OriginalListResponse["files"][number]
    >();
    expectTypeOf<RequiredKeys<LanFileListResponse["files"][number]>>().toEqualTypeOf<
      RequiredKeys<OriginalListResponse["files"][number]>
    >();
    expectTypeOf<LanFileListResponse["pagination"]>().toEqualTypeOf<OriginalListResponse["pagination"]>();
    expect({
      files: [],
      pagination: { page: 1, pageSize: 10, total: 0, pageCount: 0 }
    } satisfies LanFileListResponse).toEqual({
      files: [],
      pagination: { page: 1, pageSize: 10, total: 0, pageCount: 0 }
    });
  });

  it("preserves the exact failure status set and original schema references", () => {
    expect(Object.keys(lanFailureResponses).map(Number)).toEqual([
      400, 401, 403, 404, 409, 413, 415, 429, 500, 503, 507
    ]);
    for (const schema of Object.values(lanFailureResponses)) expect(schema).toBe(ApiFailureSchema);
  });
});
