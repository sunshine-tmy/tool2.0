import { describe, expect, expectTypeOf, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import * as root from "../index";
import * as original from "../audio-library/contracts";
import * as library from "../audio-library/index";

describe("audio-library compatibility entry", () => {
  it("exposes exactly the existing library contracts, without other domains", () => {
    expect(Object.keys(library).sort()).toEqual(Object.keys(original).sort());
    expect(library).not.toHaveProperty("ImageAiTaskSchema");
    expect(library).not.toHaveProperty("ChatterboxTaskSchema");
  });

  it("reuses all original schemas and quotas through both entry points", () => {
    for (const [name, value] of Object.entries(original)) {
      expect(Reflect.get(library, name), name).toBe(value);
      expect(Reflect.get(root, name), name).toBe(value);
    }
    expect(library.AUDIO_LIBRARY_MAX_FILE_BYTES).toBe(100 * 1024 * 1024);
    expect(library.AUDIO_LIBRARY_DEFAULT_STORAGE_BYTES).toBe(10 * 1024 ** 3);
  });

  it("preserves nullable groups, optional presets and revision types", () => {
    expectTypeOf<library.AudioLibraryItem>().toEqualTypeOf<root.AudioLibraryItem>();
    expectTypeOf<library.AudioLibraryEdit>().toEqualTypeOf<root.AudioLibraryEdit>();
    expectTypeOf<library.AudioLibraryItem["groupId"]>().toEqualTypeOf<string | null>();
    expectTypeOf<library.AudioLibraryCatalog["presets"]>().toEqualTypeOf<root.AudioLibraryPreset[] | undefined>();
    expectTypeOf<library.AudioLibraryEdit["revision"]>().toEqualTypeOf<number | undefined>();
  });

  it("keeps legacy catalogs without presets readable and unknown fields rejected", () => {
    const catalog = { version: 1, libraryId: "library-1", revision: 0, groups: [], items: [], pendingDeletes: [] };
    expect(Value.Check(library.AudioLibraryCatalogSchema, catalog)).toBe(true);
    expect(Value.Check(library.AudioLibraryCatalogSchema, { ...catalog, presets: [] })).toBe(true);
    expect(Value.Check(library.AudioLibraryCatalogSchema, { ...catalog, presets: null })).toBe(false);
    expect(Value.Check(library.AudioLibraryCatalogSchema, { ...catalog, secret: "not-allowed" })).toBe(false);
  });

  it("keeps edit/import/preset acceptance and detailed errors unchanged", () => {
    const samples = [
      [
        library.AudioLibraryEditSchema,
        root.AudioLibraryEditSchema,
        [{}, { groupId: null }, { revision: 0 }, { path: "x" }]
      ],
      [
        library.AudioLibraryGroupSchema,
        root.AudioLibraryGroupSchema,
        [
          { id: "group-1", name: "分组", parentId: null },
          { id: "group-1", name: "分组" }
        ]
      ],
      [
        library.AudioLibraryImportSchema,
        root.AudioLibraryImportSchema,
        [
          { batchId: "batch-1", itemIds: ["item-1"] },
          { batchId: "batch-1", itemIds: ["item-1", "item-1"] }
        ]
      ],
      [
        library.AudioLibraryPresetInputSchema,
        root.AudioLibraryPresetInputSchema,
        [
          { name: "预设", itemIds: ["item-1"], mode: "sequence", gap: 0 },
          { name: "预设", itemIds: [], mode: "sequence", gap: 0 }
        ]
      ]
    ] as const;
    for (const [schema, oldSchema, values] of samples) {
      for (const value of values) {
        expect(Value.Check(schema, value)).toBe(Value.Check(oldSchema, value));
        expect([...Value.Errors(schema, value)]).toEqual([...Value.Errors(oldSchema, value)]);
      }
    }
    expect(Value.Check(library.AudioLibraryEditSchema, { groupId: null })).toBe(true);
    expect(Value.Check(library.AudioLibraryEditSchema, { revision: 0 })).toBe(false);
  });
});
