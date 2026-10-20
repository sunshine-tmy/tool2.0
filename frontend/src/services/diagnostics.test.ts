import { describe, expect, it, vi } from "vitest";
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("./http", () => ({ httpClient: http }));
import { diagnosticsApi, diagnosticConnection } from "./diagnostics";
describe("diagnostics client", () => {
  it("coalesces concurrent lightweight status requests", async () => {
    http.get.mockResolvedValue({ checks: [{ status: "not-installed" }] });
    await Promise.all([diagnosticsApi.snapshot(true), diagnosticsApi.snapshot(true)]);
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(diagnosticConnection.value).toBe("online");
  });
  it("keeps faults distinct from optional uninstalled capabilities", async () => {
    http.get.mockResolvedValue({ checks: [{ status: "warning" }] });
    await diagnosticsApi.snapshot(true);
    expect(diagnosticConnection.value).toBe("partial");
    http.get.mockRejectedValue(new Error("offline"));
    await expect(diagnosticsApi.snapshot(true)).rejects.toThrow();
    expect(diagnosticConnection.value).toBe("offline");
  });
  it("uses explicit deep consent and fixed recovery actions", async () => {
    await diagnosticsApi.start({ depth: "deep", targets: ["edge-tts"], confirmed: true });
    expect(http.post).toHaveBeenCalledWith(
      "/diagnostics/runs",
      expect.anything(),
      { depth: "deep", targets: ["edge-tts"], confirmed: true },
      { timeout: 10000 }
    );
    await diagnosticsApi.restart("chatterbox");
    expect(http.post).toHaveBeenLastCalledWith("/diagnostics/actions", expect.anything(), {
      action: "restart-worker",
      componentId: "chatterbox",
      confirmed: true
    });
  });
});
