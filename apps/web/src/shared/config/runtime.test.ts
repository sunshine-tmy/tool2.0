/**
 * 中文模块说明：测试 apps/web/src/shared/config/runtime.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { normalizeApiBaseUrl, resolveBackendUrl, runtimeApiBaseUrl } from "./runtime";

describe("runtime API configuration", () => {
  it("keeps desktop requests on the assigned app origin while preserving browser development overrides", () => {
    expect(runtimeApiBaseUrl("http://127.0.0.1:3100/api", true)).toBe("/api/v1");
    expect(runtimeApiBaseUrl("http://127.0.0.1:3100/api", false)).toBe("http://127.0.0.1:3100/api/v1");
  });
  it("upgrades legacy API base URLs to the v1 namespace", () => {
    expect(normalizeApiBaseUrl("http://192.168.1.241:3100/api")).toBe("http://192.168.1.241:3100/api/v1");
    expect(normalizeApiBaseUrl("/api/")).toBe("/api/v1");
    expect(normalizeApiBaseUrl("/api/v1/")).toBe("/api/v1");
    expect(normalizeApiBaseUrl()).toBe("/api/v1");
  });

  it("upgrades backend URLs persisted by pre-v1 releases", () => {
    expect(resolveBackendUrl("/api/health")).toBe("/api/v1/health");
    expect(resolveBackendUrl("/api/tools/xhs-archive/items/item-1/media/media-1")).toBe(
      "/api/v1/tools/xhs-archive/items/item-1/media/media-1"
    );
    expect(resolveBackendUrl("https://cdn.example.com/media.jpg")).toBe("https://cdn.example.com/media.jpg");
  });
});
