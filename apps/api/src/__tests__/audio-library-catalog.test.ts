import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AudioLibraryCatalog, AudioLibraryPreset } from "@toolbox/shared";
import { readCatalog } from "../domains/audio-library/store";
import {
  readCatalog as readDomainCatalog,
  normalizeAudioLibraryText,
  validateAudioLibraryCatalog
} from "../domains/audio-library/catalog";
import { createAudioLibraryFixture } from "./helpers/audio-library";

let context: Awaited<ReturnType<typeof createAudioLibraryFixture>>;
let catalog: AudioLibraryCatalog;
beforeEach(async () => {
  context = await createAudioLibraryFixture();
  await context.asset("item", null);
  catalog = await context.store.snapshot();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await context.dispose();
});

function preset(id: string, name: string): AudioLibraryPreset {
  return {
    id,
    name,
    itemIds: ["item"],
    mode: "list",
    gap: 1,
    revision: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  };
}

it("keeps the compatibility export on the one canonical reader and synchronous validator", () => {
  expect(readCatalog).toBe(readDomainCatalog);
  expect(validateAudioLibraryCatalog(catalog)).toBeUndefined();
});

it.each([
  [" Ｑｕｅｕｅ ", "queue"],
  [" 中文　分组 ", "中文 分组"],
  [" A\nB ", "a\nb"],
  [" ", ""]
])("preserves domain text normalization for %j", (input, expected) => {
  expect(normalizeAudioLibraryText(input)).toBe(expected);
});

it.each([undefined, null, false, 1, "text", [], {}, { items: null }, { items: {} }].map((input) => ({ input })))(
  "rejects non-catalog input $input",
  ({ input }) => {
    expect(readCatalog(input)).toBeUndefined();
  }
);

it("returns a deep independent copy and leaves absence of the old optional presets field unchanged", () => {
  delete catalog.presets;
  const value = readCatalog(catalog)!;
  expect(value).toEqual(catalog);
  expect(value).not.toHaveProperty("presets");
  value.items[0].source.originalName = "changed";
  value.items[0].title = "changed";
  expect(catalog.items[0]).toMatchObject({ title: "item", source: { originalName: "fixture.wav" } });
});

it.each([false, true])(
  "strips only the supported retired fields without changing the input (favorite=%s)",
  (favorite) => {
    const legacy = { ...catalog, tags: ["旧标签"], items: [{ ...catalog.items[0], tags: ["一", "二"], favorite }] };
    expect(readCatalog(legacy)).toEqual(catalog);
    expect(legacy.tags).toEqual(["旧标签"]);
    expect(legacy.items[0]).toMatchObject({ tags: ["一", "二"], favorite });
  }
);

it.each([[], Array.from({ length: 20 }, (_, i) => `tag-${i}`), ["x".repeat(30)]].map((tags) => ({ tags })))(
  "keeps accepted legacy item-tag boundaries $tags",
  ({ tags }) => {
    expect(readCatalog({ ...catalog, items: [{ ...catalog.items[0], tags }] })).toEqual(catalog);
  }
);

it("does not incorrectly impose the item's count/uniqueness limits on retired catalog-level tags", () => {
  expect(readCatalog({ ...catalog, tags: Array.from({ length: 21 }, () => "same") })).toEqual(catalog);
});

it.each([
  { label: "catalog-tags-number", change: (c: AudioLibraryCatalog) => ({ ...c, tags: 1 }) },
  { label: "catalog-tags-undefined", change: (c: AudioLibraryCatalog) => ({ ...c, tags: undefined }) },
  { label: "catalog-tag-empty", change: (c: AudioLibraryCatalog) => ({ ...c, tags: [""] }) },
  {
    label: "item-tag-duplicate",
    change: (c: AudioLibraryCatalog) => ({ ...c, items: [{ ...c.items[0], tags: ["same", "same"] }] })
  },
  {
    label: "item-tag-count",
    change: (c: AudioLibraryCatalog) => ({
      ...c,
      items: [{ ...c.items[0], tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) }]
    })
  },
  {
    label: "item-tag-length",
    change: (c: AudioLibraryCatalog) => ({ ...c, items: [{ ...c.items[0], tags: ["x".repeat(31)] }] })
  },
  { label: "item-tag-type", change: (c: AudioLibraryCatalog) => ({ ...c, items: [{ ...c.items[0], tags: [1] }] }) },
  {
    label: "favorite-type",
    change: (c: AudioLibraryCatalog) => ({ ...c, items: [{ ...c.items[0], favorite: "yes" }] })
  },
  {
    label: "favorite-undefined",
    change: (c: AudioLibraryCatalog) => ({ ...c, items: [{ ...c.items[0], favorite: undefined }] })
  },
  { label: "unknown-catalog", change: (c: AudioLibraryCatalog) => ({ ...c, extra: true }) },
  { label: "unknown-item", change: (c: AudioLibraryCatalog) => ({ ...c, items: [{ ...c.items[0], extra: true }] }) },
  {
    label: "unknown-source",
    change: (c: AudioLibraryCatalog) => ({
      ...c,
      items: [{ ...c.items[0], source: { ...c.items[0].source, extra: true } }]
    })
  },
  {
    label: "unknown-group",
    change: (c: AudioLibraryCatalog) => ({
      ...c,
      groups: [{ id: "group", name: "group", parentId: null, extra: true }]
    })
  },
  {
    label: "unknown-pending",
    change: (c: AudioLibraryCatalog) => ({ ...c, pendingDeletes: [{ id: "pending", bytes: 1, extra: true }] })
  },
  { label: "null-item", change: (c: AudioLibraryCatalog) => ({ ...c, items: [null] }) },
  { label: "unsupported-version", change: (c: AudioLibraryCatalog) => ({ ...c, version: 2 }) }
])("rejects $label without mutating its candidate", ({ change }) => {
  const input = change(catalog),
    before = structuredClone(input);
  expect(readCatalog(input)).toBeUndefined();
  expect(input).toEqual(before);
});

it("keeps Schema reading separate from semantic identity validation", async () => {
  const duplicate = { ...catalog, items: [catalog.items[0], structuredClone(catalog.items[0])] };
  expect(readCatalog(duplicate)).toEqual(duplicate);
  await expect(
    context.store.mutate((c) => {
      c.items = duplicate.items;
    })
  ).rejects.toMatchObject({ code: "AUDIO_LIBRARY_INVALID", message: "音频库标识重复", status: 400 });
  expect(await context.store.snapshot()).toEqual(catalog);
});

it.each([
  {
    label: "duplicate-group-id",
    code: "AUDIO_LIBRARY_INVALID",
    status: 400,
    change: (c: AudioLibraryCatalog) => {
      c.groups = [
        { id: "same", name: "a", parentId: null },
        { id: "same", name: "b", parentId: null }
      ];
    }
  },
  {
    label: "duplicate-preset-id",
    code: "AUDIO_LIBRARY_PRESET_DUPLICATE",
    status: 409,
    change: (c: AudioLibraryCatalog) => {
      c.presets = [preset("same", "a"), preset("same", "b")];
    }
  },
  {
    label: "normalized-preset-name",
    code: "AUDIO_LIBRARY_PRESET_DUPLICATE",
    status: 409,
    change: (c: AudioLibraryCatalog) => {
      c.presets = [preset("one", "QUEUE"), preset("two", " ｑｕｅｕｅ ")];
    }
  },
  {
    label: "blank-preset-name",
    code: "AUDIO_LIBRARY_PRESET_DUPLICATE",
    status: 409,
    change: (c: AudioLibraryCatalog) => {
      c.presets = [preset("one", " ")];
    }
  },
  {
    label: "missing-item-group",
    code: "AUDIO_LIBRARY_GROUP_NOT_FOUND",
    status: 404,
    change: (c: AudioLibraryCatalog) => {
      c.items[0].groupId = "missing";
    }
  },
  {
    label: "normalized-sibling-name",
    code: "AUDIO_LIBRARY_GROUP_DUPLICATE",
    status: 409,
    change: (c: AudioLibraryCatalog) => {
      c.groups = [
        { id: "one", name: "TOP", parentId: null },
        { id: "two", name: " ｔｏｐ ", parentId: null }
      ];
    }
  },
  {
    label: "missing-parent",
    code: "AUDIO_LIBRARY_GROUP_NOT_FOUND",
    status: 404,
    change: (c: AudioLibraryCatalog) => {
      c.groups = [{ id: "one", name: "one", parentId: "missing" }];
    }
  },
  {
    label: "cycle",
    code: "AUDIO_LIBRARY_GROUP_DEPTH",
    status: 400,
    change: (c: AudioLibraryCatalog) => {
      c.groups = [{ id: "one", name: "one", parentId: "one" }];
    }
  },
  {
    label: "fourth-level",
    code: "AUDIO_LIBRARY_GROUP_DEPTH",
    status: 400,
    change: (c: AudioLibraryCatalog) => {
      c.groups = Array.from({ length: 4 }, (_, i) => ({
        id: `g-${i}`,
        name: `g-${i}`,
        parentId: i ? `g-${i - 1}` : null
      }));
    }
  },
  {
    label: "preset-before-group-priority",
    code: "AUDIO_LIBRARY_PRESET_DUPLICATE",
    status: 409,
    change: (c: AudioLibraryCatalog) => {
      c.presets = [preset("one", "same"), preset("two", "same")];
      c.items[0].groupId = "missing";
    }
  }
])("preserves $label validation error and commit atomicity", async ({ change, code, status }) => {
  await expect(context.store.mutate(change)).rejects.toMatchObject({ code, status });
  expect(await context.store.snapshot()).toEqual(catalog);
});

it("preserves Schema-before-semantic error priority", async () => {
  await expect(
    context.store.mutate((c) => {
      c.items[0].bytes = 0;
      c.items.push(structuredClone(c.items[0]));
    })
  ).rejects.toMatchObject({ code: "AUDIO_LIBRARY_INVALID", message: "音频库数据不符合约定", status: 400 });
  expect(await context.store.snapshot()).toEqual(catalog);
});

it("permits three levels, sibling namespaces and unavailable preset references without normalizing stored data", async () => {
  await context.store.mutate((c) => {
    c.groups = [
      { id: "one", name: " Top ", parentId: null },
      { id: "two", name: "leaf", parentId: "one" },
      { id: "three", name: "leaf", parentId: "two" }
    ];
    c.items[0].groupId = "three";
    c.presets = [{ ...preset("queue", " Queue "), itemIds: ["missing", "item", "missing"] }];
  });
  const after = await context.store.snapshot();
  expect(after.groups[0].name).toBe(" Top ");
  expect(after.presets?.[0].name).toBe(" Queue ");
  expect(after.presets?.[0].itemIds).toEqual(["missing", "item", "missing"]);
});
