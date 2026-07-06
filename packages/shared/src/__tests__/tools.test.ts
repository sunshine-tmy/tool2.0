import { describe, expect, it } from "vitest";
import { getToolById, listTools } from "../tools";

describe("tool registry", () => {
  it("lists the initial no-login toolbox modules", () => {
    const tools = listTools();

    expect(tools.map((tool) => tool.id)).toEqual([
      "image-compress",
      "format-convert",
      "lan-transfer",
      "video-text"
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
    expect(getToolById("format-convert")).toMatchObject({
      routePath: "/tools/format-convert",
      apiNamespace: "/api/tools/format-convert"
    });
    expect(getToolById("lan-transfer")).toMatchObject({
      routePath: "/tools/lan-transfer",
      apiNamespace: "/api/tools/lan-transfer"
    });
  });
});
