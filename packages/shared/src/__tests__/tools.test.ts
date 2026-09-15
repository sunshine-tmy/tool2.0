import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { ToolListSchema } from "../api-schema";
import { getToolById, listTools } from "../tools";

describe("tool registry", () => {
  it("lists the initial no-login toolbox modules", () => {
    const tools = listTools();

    expect(tools.map((tool) => tool.id)).toEqual([
      "image-compress",
      "image-ai",
      "lan-transfer",
      "video-text",
      "edge-tts",
      "short-video",
      "xhs-archive"
    ]);
    expect(tools.every((tool) => tool.requiresAuth === false)).toBe(true);
    expect(Value.Check(ToolListSchema, tools)).toBe(true);
  });

  it("finds a tool by id", () => {
    expect(getToolById("image-compress")?.title).toBe("图片压缩");
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
    expect(getToolById("video-text")).toMatchObject({
      routePath: "/tools/video-text",
      apiNamespace: "/api/v1/tools/video-text"
    });
    expect(getToolById("edge-tts")).toMatchObject({
      routePath: "/tools/edge-tts",
      apiNamespace: "/api/v1/tools/edge-tts"
    });
    expect(getToolById("short-video")).toMatchObject({
      routePath: "/tools/short-video",
      apiNamespace: "/api/v1/tools/short-video"
    });
    expect(getToolById("xhs-archive")).toMatchObject({
      routePath: "/tools/xhs-archive",
      apiNamespace: "/api/v1/tools/xhs-archive"
    });
  });
});
