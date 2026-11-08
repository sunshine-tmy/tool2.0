// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { workbenchTools } from "./catalog";
import ToolPageDecoration from "./ToolPageDecoration.vue";

describe("module header decorations", () => {
  it("covers all 13 catalog tools without introducing accessible or interactive controls", () => {
    const tools = workbenchTools();
    expect(tools).toHaveLength(13);
    const motifs = new Set<string>();
    for (const tool of tools) {
      const view = mount(ToolPageDecoration, { props: { toolId: tool.id } });
      expect(view.attributes("data-tool-decoration")).toBe(tool.id);
      expect(view.attributes("aria-hidden")).toBe("true");
      expect(view.get("svg").attributes("focusable")).toBe("false");
      expect(view.find("button, a, input, [tabindex]").exists()).toBe(false);
      motifs.add(
        view
          .findAll("path")
          .map((path) => path.attributes("d"))
          .join(" ")
      );
      view.unmount();
    }
    expect(motifs.size).toBe(13);
  });

  it("leaves non-tool system pages undecorated", () => {
    const view = mount(ToolPageDecoration, { props: { toolId: "settings" } });
    expect(view.find(".tool-page-decoration").exists()).toBe(false);
    view.unmount();
  });
});
