// @vitest-environment happy-dom
/** 产品更名保留旧收藏入口、查询参数和 hash，避免桌面/Web 深链接失效。 */
import { describe, expect, it } from "vitest";
import { router } from "./router";

describe("多媒体归档路由兼容", () => {
  it("新入口继续复用已有页面懒加载与稳定路由名", () => {
    expect(router.resolve("/tools/media-archive").name).toBe("xhs-archive");
    expect(router.getRoutes().find((route) => route.path === "/tools/media-archive")?.components?.default).toBeTypeOf(
      "function"
    );
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
