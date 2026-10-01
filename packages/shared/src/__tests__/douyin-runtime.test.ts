/** 匿名能力契约：禁止配置登录、跨平台浏览器或漂移版本；状态 DTO 不暴露本地资产路径。 */
import fs from "node:fs";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { DouyinRuntimeStatusSchema, isDouyinAdapterManifest } from "../douyin-runtime";

const descriptor: Record<string, unknown> = JSON.parse(
  fs.readFileSync(
    new URL("../../../../packaging/components/douyin-archive/adapter/manifest.json", import.meta.url),
    "utf8"
  )
);
describe("抖音匿名能力契约", () => {
  it("仓库内分发模板与共享协议一致", () => {
    expect(isDouyinAdapterManifest(descriptor)).toBe(true);
  });
  it.each([
    ["mode", "authenticated"],
    ["protocolVersion", 2],
    ["browserComponentId", "system-chrome"],
    ["playwrightVersion", "latest"],
    ["chromiumVersion", "152.0.0.1"],
    ["chromiumRevision", "unknown"],
    ["sourceRevision", "HEAD"],
    ["cookie", "secret"]
  ])("拒绝漂移或敏感字段 %s", (key, value) => {
    expect(isDouyinAdapterManifest({ ...descriptor, [key]: value })).toBe(false);
  });
  it("状态 DTO 明确匿名、不伪造登录状态且拒绝内部路径", () => {
    const status = { platform: "douyin", mode: "anonymous", available: true, state: "ready", message: "匿名环境就绪" };
    expect(Value.Check(DouyinRuntimeStatusSchema, status)).toBe(true);
    expect(Value.Check(DouyinRuntimeStatusSchema, { ...status, executablePath: "C:/private/browser.exe" })).toBe(false);
    expect(Value.Check(DouyinRuntimeStatusSchema, { ...status, authenticated: true })).toBe(false);
  });
});
