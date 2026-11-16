import { afterEach, expect, it, vi } from "vitest";
import { requestWorkerLightHealth } from "../core/workers/light-health";

afterEach(() => vi.unstubAllGlobals());

it("calls only the authenticated lightweight loopback health endpoint", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ protocolVersion: 1, available: true, busy: false, modelLoaded: true }), {
        headers: { "content-type": "application/json" }
      })
  );
  vi.stubGlobal("fetch", fetchMock);

  await expect(requestWorkerLightHealth("http://127.0.0.1:3210", "local-token")).resolves.toEqual({
    protocolVersion: 1,
    available: true,
    busy: false,
    modelLoaded: true
  });
  const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
  const headers = new Headers(init.headers);
  expect(url.pathname).toBe("/diagnostics/light");
  expect(init.method).toBe("GET");
  expect(headers.get("x-toolbox-worker-token")).toBe("local-token");
  expect(headers.get("x-toolbox-diagnostic")).toBe("1");
});

it("marks only a confirmed refused connection as a dead Worker", async () => {
  const cause = Object.assign(new Error("refused"), { code: "ECONNREFUSED" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Promise.reject(new TypeError("fetch failed", { cause })))
  );

  await expect(requestWorkerLightHealth("http://localhost:3210", "local-token")).rejects.toMatchObject({
    code: "WORKER_CONNECTION_REFUSED"
  });
});

it("rejects remote or credentialed targets", async () => {
  await expect(requestWorkerLightHealth("https://127.0.0.1:3210", "token")).rejects.toMatchObject({
    code: "WORKER_TARGET_UNSUPPORTED"
  });
  await expect(requestWorkerLightHealth("http://user:pass@127.0.0.1:3210", "token")).rejects.toMatchObject({
    code: "WORKER_TARGET_UNSUPPORTED"
  });
});
