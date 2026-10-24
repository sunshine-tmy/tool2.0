import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AudioLibraryListSchema,
  AudioLibraryItemViewSchema,
  AudioLibraryMutationSchema,
  AudioLibraryImportResultSchema,
  AudioLibraryPresetSchema,
  AudioLibraryPresetLoadSchema
} from "@toolbox/shared";
import { audioLibraryApi } from "./api";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../shared/http/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: http
}));
beforeEach(() => {
  vi.clearAllMocks();
  for (const method of Object.values(http)) method.mockResolvedValue({ ok: true });
});

describe("audio library domain client", () => {
  it("keeps list/edit URLs, root-compatible schemas and nullable groups", async () => {
    await audioLibraryApi.list({ page: 2 });
    await audioLibraryApi.edit("item-1", { revision: 2, groupId: null });
    expect(http.get).toHaveBeenCalledWith("/tools/audio-library/items", AudioLibraryListSchema, {
      params: { page: 2 }
    });
    expect(http.patch).toHaveBeenCalledWith("/tools/audio-library/items/item-1", AudioLibraryItemViewSchema, {
      revision: 2,
      groupId: null
    });
  });

  it("keeps trash, restore and permanent purge as distinct requests", async () => {
    await audioLibraryApi.trash(["one"]);
    await audioLibraryApi.trash(["two"], true);
    await audioLibraryApi.purge("three");
    expect(http.post).toHaveBeenNthCalledWith(1, "/tools/audio-library/items/batch-trash", AudioLibraryMutationSchema, {
      ids: ["one"],
      restore: false
    });
    expect(http.post).toHaveBeenNthCalledWith(2, "/tools/audio-library/items/batch-trash", AudioLibraryMutationSchema, {
      ids: ["two"],
      restore: true
    });
    expect(http.delete).toHaveBeenCalledWith("/tools/audio-library/trash/three", AudioLibraryMutationSchema);
  });

  it("preserves the two speech import endpoints and their unmodified payloads", async () => {
    const input = { batchId: "batch-1", itemIds: ["item-1"], attempts: { "item-1": 2 }, groupId: null };
    await audioLibraryApi.importChatterbox(input);
    await audioLibraryApi.importEdgeTts(input);
    expect(http.post).toHaveBeenNthCalledWith(
      1,
      "/tools/audio-library/imports/chatterbox",
      AudioLibraryImportResultSchema,
      input
    );
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      "/tools/audio-library/imports/edge-tts",
      AudioLibraryImportResultSchema,
      input
    );
  });

  it("preserves preset creation/update, load and revision-protected deletion", async () => {
    const input = { name: "队列", itemIds: ["item-1"], mode: "sequence" as const, gap: 0 };
    await audioLibraryApi.savePreset(input);
    await audioLibraryApi.savePreset({ ...input, revision: 3 }, "preset-1");
    await audioLibraryApi.loadPreset("preset-1");
    await audioLibraryApi.deletePreset("preset-1", 3);
    expect(http.post).toHaveBeenCalledWith("/tools/audio-library/presets", AudioLibraryPresetSchema, input);
    expect(http.patch).toHaveBeenCalledWith("/tools/audio-library/presets/preset-1", AudioLibraryPresetSchema, {
      ...input,
      revision: 3
    });
    expect(http.get).toHaveBeenCalledWith("/tools/audio-library/presets/preset-1/load", AudioLibraryPresetLoadSchema);
    expect(http.delete).toHaveBeenCalledWith("/tools/audio-library/presets/preset-1", AudioLibraryMutationSchema, {
      data: { revision: 3 }
    });
  });
});
