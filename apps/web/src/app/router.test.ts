// @vitest-environment happy-dom
/** 产品更名保留旧收藏入口、查询参数和 hash，避免桌面/Web 深链接失效。 */
import { describe, expect, it } from "vitest";
import { router } from "./router";

describe("多媒体归档路由兼容", () => {
  it("注册十二个工具模块及归档兼容跳转", () => {
    expect(
      router
        .getRoutes()
        .filter((route) => route.path.startsWith("/tools/"))
        .map((route) => route.path)
        .sort()
    ).toEqual([
      "/tools/audio-convert",
      "/tools/audio-extract",
      "/tools/audio-library",
      "/tools/base64",
      "/tools/edge-tts",
      "/tools/image-ai",
      "/tools/image-compress",
      "/tools/json-format",
      "/tools/lan-transfer",
      "/tools/media-archive",
      "/tools/media-archive/video-editor/:itemId/:mediaId",
      "/tools/url-codec",
      "/tools/uuid-generator",
      "/tools/xhs-archive"
    ]);
  });
  it("归档、首页和 JSON 工具使用懒加载并保留稳定路由名", () => {
    expect(router.resolve("/tools/media-archive").name).toBe("xhs-archive");
    expect(router.resolve("/tools/json-format").name).toBe("json-format");
    expect(router.resolve("/tools/url-codec").name).toBe("url-codec");
    expect(router.resolve("/tools/uuid-generator").name).toBe("uuid-generator");
    for (const path of [
      "/",
      "/tools/media-archive",
      "/tools/json-format",
      "/tools/base64",
      "/tools/url-codec",
      "/tools/uuid-generator"
    ])
      expect(router.getRoutes().find((route) => route.path === path)?.components?.default).toBeTypeOf("function");
  });

  it("旧入口的重定向保留参数，不重定向 API 或磁盘目录", () => {
    const redirect = router.getRoutes().find((route) => route.path === "/tools/xhs-archive")?.redirect;
    expect(redirect).toBeTypeOf("function");
    if (typeof redirect !== "function") throw new Error("缺少旧归档路由重定向");
    expect(redirect(router.resolve("/tools/xhs-archive?item=old-id#frame"), router.currentRoute.value)).toEqual({
      path: "/tools/media-archive",
      query: { item: "old-id" },
      hash: "#frame"
    });
  });
});
