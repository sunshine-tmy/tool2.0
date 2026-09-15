import { describe, expect, it, vi } from "vitest";
import {
  assertPublicRemoteUrl,
  createRemoteFetch,
  fetchRemoteResponse,
  limitedResponseStream
} from "../security/remote-fetch";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

describe("safe remote fetch", () => {
  it.each([
    "http://127.0.0.1/resource",
    "http://10.0.0.1/resource",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/resource",
    "http://[::ffff:192.168.1.1]/resource",
    "http://localhost/resource",
    "http://user:password@example.com/resource",
    "http://example.com:8080/resource"
  ])("rejects private or unsafe target %s", async (value) => {
    await expect(assertPublicRemoteUrl(new URL(value), publicResolver)).rejects.toThrow();
  });

  it("rejects hostnames when DNS returns any private address", async () => {
    await expect(
      assertPublicRemoteUrl(new URL("https://media.example/video.mp4"), async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "192.168.1.5", family: 4 }
      ])
    ).rejects.toThrow(/private or reserved/i);
  });

  it("revalidates every redirect target", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    const remoteFetch = createRemoteFetch({ resolver: publicResolver, fetchImpl });

    await expect(remoteFetch("https://media.example/video.mp4")).rejects.toThrow(/private|local/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("resolves each redirect hostname before connecting", async () => {
    const resolver = vi.fn(async (hostname: string) => {
      if (hostname === "media.example" || hostname === "cdn.example") {
        return [{ address: "93.184.216.34", family: 4 }];
      }
      throw new Error(`unexpected hostname: ${hostname}`);
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://cdn.example/video.mp4" } })
      )
      .mockResolvedValueOnce(new Response("media"));
    const remoteFetch = createRemoteFetch({ resolver, fetchImpl });

    await expect(remoteFetch("https://media.example/video.mp4")).resolves.toMatchObject({ status: 200 });
    expect(resolver).toHaveBeenNthCalledWith(1, "media.example");
    expect(resolver).toHaveBeenNthCalledWith(2, "cdn.example");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://cdn.example/video.mp4",
      expect.objectContaining({ redirect: "manual" })
    );
  });

  it("uses the timeout only until remote response headers arrive", async () => {
    let requestSignal: AbortSignal | undefined;
    const response = await fetchRemoteResponse(
      async (_url, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Response("media");
      },
      "https://media.example/video.mp4",
      {},
      10
    );

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(requestSignal?.aborted).toBe(false);
    await expect(response.text()).resolves.toBe("media");
  });

  it("forwards aborted remote body errors to the capped stream", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("partial"));
          queueMicrotask(() => controller.error(new DOMException("The operation timed out", "TimeoutError")));
        }
      })
    );
    await expect(
      pipeline(
        limitedResponseStream(response, 1024),
        new Writable({
          write(_chunk, _encoding, callback) {
            callback();
          }
        })
      )
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
