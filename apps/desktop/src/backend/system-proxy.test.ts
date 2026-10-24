import { describe, expect, it } from "vitest";
import { componentProxyUrlFromResolution } from "./system-proxy";

describe("componentProxyUrlFromResolution", () => {
  it("returns no proxy for a direct system route", () => {
    expect(componentProxyUrlFromResolution("DIRECT")).toBeUndefined();
  });

  it("selects the HTTP proxy from Electron's PAC result", () => {
    expect(componentProxyUrlFromResolution("PROXY 127.0.0.1:7897; DIRECT")).toBe("http://127.0.0.1:7897/");
  });

  it("supports an HTTPS proxy endpoint", () => {
    expect(componentProxyUrlFromResolution("HTTPS proxy.example:8443; DIRECT")).toBe("https://proxy.example:8443/");
  });

  it("skips unsupported or malformed entries without credentials", () => {
    expect(
      componentProxyUrlFromResolution("SOCKS5 127.0.0.1:1080; PROXY user:password@proxy.example:8080; DIRECT")
    ).toBeUndefined();
  });

  it("falls through malformed PAC candidates to the next supported proxy", () => {
    expect(componentProxyUrlFromResolution("PROXY [invalid; PROXY proxy.example:8080; DIRECT")).toBe(
      "http://proxy.example:8080/"
    );
  });
});
