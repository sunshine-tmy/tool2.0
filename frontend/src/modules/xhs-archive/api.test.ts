/** 登录别名保持短视频解析原有入口和语义，不给抖音添加本期跳过的登录。 */
import { expect, it } from "vitest";
import { contentArchiveApi } from "./content-api";
import { xhsArchiveApi } from "./api";
it("旧登录客户端直接复用同一中性客户端中的 XHS 登录方法", () => {
  expect(xhsArchiveApi.startAuth).toBe(contentArchiveApi.startXhsAuth);
  expect(xhsArchiveApi.auth).toBe(contentArchiveApi.xhsAuth);
});
