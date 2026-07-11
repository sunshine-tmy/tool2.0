import { describe, expect, it, vi } from "vitest";
import { assertPublicRemoteUrl, createRemoteFetch } from "../security/remote-fetch";

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
});
