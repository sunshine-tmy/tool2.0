/**
 * 中文模块说明：测试 packages/shared/src/__tests__/tools.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { ToolListSchema, ToolDefinitionSchema } from "../common/api-schema";
import { getToolById, listTools } from "../common/tools";

describe("tool registry", () => {
  it("lists the initial no-login toolbox modules", () => {
    const tools = listTools();

    expect(tools.map((tool) => tool.id)).toEqual([
      "image-compress",
      "image-ai",
      "lan-transfer",
      "edge-tts",
      "audio-library",
      "audio-extract",
      "audio-convert",
      "xhs-archive",
      "video-subtitle",
      "json-format",
      "base64",
      "url-codec",
      "uuid-generator"
    ]);
    expect(tools.every((tool) => tool.requiresAuth === false)).toBe(true);
    expect(Value.Check(ToolListSchema, tools)).toBe(true);
  });

  it("finds a tool by id", () => {
    expect(getToolById("image-compress")?.title).toBe("图片压缩");
  });
  it("registers UUID generation as a browser-only tool without an input upload or API", () => {
    const tool = getToolById("uuid-generator")!;
    expect(tool).toMatchObject({
      title: "UUID 生成",
      routePath: "/tools/uuid-generator",
      execution: "browser",
      apiNamespace: null,
      acceptedTypes: []
    });
    expect(Value.Check(ToolDefinitionSchema, tool)).toBe(true);
  });
  it("registers URL processing as a browser-only tool with no processing API", () => {
    const tool = getToolById("url-codec")!;
    expect(tool).toMatchObject({
      title: "URL 编解码",
      routePath: "/tools/url-codec",
      execution: "browser",
      apiNamespace: null
    });
    expect(Value.Check(ToolDefinitionSchema, tool)).toBe(true);
  });
  it("allows a browser-only tool without inventing an API and preserves all server contracts", () => {
    const json = getToolById("json-format")!;
    expect(json).toMatchObject({ execution: "browser", apiNamespace: null, routePath: "/tools/json-format" });
    expect(Value.Check(ToolDefinitionSchema, json)).toBe(true);
    expect(Value.Check(ToolDefinitionSchema, { ...json, execution: "server" })).toBe(false);
    expect(Value.Check(ToolDefinitionSchema, { ...json, apiNamespace: "" })).toBe(false);
    expect(Value.Check(ToolDefinitionSchema, { ...json, execution: undefined })).toBe(false);
    expect(
      listTools()
        .filter((tool) => tool.execution !== "browser")
        .every((tool) => tool.apiNamespace?.startsWith("/api/v1/") && tool.execution === undefined)
    ).toBe(true);
  });

  it("exposes frontend routes and api namespaces for each tool", () => {
    expect(getToolById("image-compress")).toMatchObject({
      routePath: "/tools/image-compress",
      apiNamespace: "/api/v1/tools/image-compress"
    });
    expect(getToolById("image-ai")).toMatchObject({
      routePath: "/tools/image-ai",
      apiNamespace: "/api/v1/tools/image-ai"
    });
    expect(getToolById("lan-transfer")).toMatchObject({
      routePath: "/tools/lan-transfer",
      apiNamespace: "/api/v1/tools/lan-transfer"
    });
    expect(getToolById("edge-tts")).toMatchObject({
      routePath: "/tools/edge-tts",
      apiNamespace: "/api/v1/tools/edge-tts"
    });
    expect(getToolById("xhs-archive")).toMatchObject({
      title: "多媒体内容归档",
      routePath: "/tools/media-archive",
      apiNamespace: "/api/v1/tools/xhs-archive"
    });
  });
});
