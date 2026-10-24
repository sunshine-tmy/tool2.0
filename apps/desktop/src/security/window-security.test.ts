import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, isTrustedBackendUrl } from "./window-security";

describe("window navigation policy", () => {
  const origin = "http://127.0.0.1:43123";

  it("keeps in-window navigation on the desktop backend origin", () => {
    expect(isTrustedBackendUrl("http://127.0.0.1:43123/products", origin)).toBe(true);
    expect(isTrustedBackendUrl("http://127.0.0.1:43124/products", origin)).toBe(false);
    expect(isTrustedBackendUrl("https://example.com", origin)).toBe(false);
  });

  it("allows only HTTPS links to leave the application", () => {
    expect(isSafeExternalUrl("https://example.com/help")).toBe(true);
    expect(isSafeExternalUrl("http://example.com/help")).toBe(false);
    expect(isSafeExternalUrl("file:///C:/Windows/System32")).toBe(false);
    expect(isSafeExternalUrl("not a url")).toBe(false);
  });
});
