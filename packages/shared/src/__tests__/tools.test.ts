import { describe, expect, it } from "vitest";
import { getToolById, listTools } from "../tools";

describe("tool registry", () => {
  it("lists the initial no-login toolbox modules", () => {
    const tools = listTools();

    expect(tools.map((tool) => tool.id)).toEqual([
      "image-compress",
      "lan-transfer",
      "video-text",
      "short-video"
    ]);
    expect(tools.every((tool) => tool.requiresAuth === false)).toBe(true);
  });

  it("finds a tool by id", () => {
    expect(getToolById("image-compress")?.title).toBe("图片压缩");
  });

  it("exposes frontend routes and api namespaces for each tool", () => {
    expect(getToolById("image-compress")).toMatchObject({
      routePath: "/tools/image-compress",
      apiNamespace: "/api/tools/image-compress"
    });
    expect(getToolById("lan-transfer")).toMatchObject({
      routePath: "/tools/lan-transfer",
      apiNamespace: "/api/tools/lan-transfer"
    });
    expect(getToolById("video-text")).toMatchObject({
      routePath: "/tools/video-text",
      apiNamespace: "/api/tools/video-text"
    });
    expect(getToolById("short-video")).toMatchObject({
      routePath: "/tools/short-video",
      apiNamespace: "/api/tools/short-video"
    });
  });
});
