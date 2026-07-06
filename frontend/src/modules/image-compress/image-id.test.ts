import { describe, expect, it, vi } from "vitest";
import { createImageItemId } from "./image-id";

describe("image item id", () => {
  it("falls back when crypto.randomUUID is unavailable", () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {});

    const id = createImageItemId();

    expect(id).toMatch(/^image-\d+-[a-z0-9]+$/);
    vi.stubGlobal("crypto", originalCrypto);
  });
});
