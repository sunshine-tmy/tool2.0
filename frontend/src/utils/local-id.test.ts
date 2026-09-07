import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalId } from "./local-id";

describe("local id", () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => vi.stubGlobal("crypto", originalCrypto));

  it("uses randomUUID when the browser provides it", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "secure-id" });
    expect(createLocalId("segment")).toBe("secure-id");
  });

  it("falls back on LAN HTTP origins where randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});
    const first = createLocalId("segment");
    const second = createLocalId("segment");
    expect(first).toMatch(/^segment-\d+-\d+-[a-z0-9]+$/);
    expect(second).not.toBe(first);
  });
});
