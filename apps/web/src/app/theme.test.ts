import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTheme } from "./theme";

describe("single CSS token source for Naive UI", () => {
  it("reads the actual final theme values rather than duplicating a second palette", () => {
    const css = readFileSync(new URL("../styles/ui-v2.css", import.meta.url), "utf8");
    const tokens = new Map(Array.from(css.matchAll(/(--[\w-]+):\s*([^;]+);/g), (m) => [m[1], m[2]]));
    const theme = createTheme({
      getPropertyValue: (name) => tokens.get(name) ?? ""
    });
    expect(theme.common).toMatchObject({
      primaryColor: "#6558ff",
      primaryColorHover: "#5748e8",
      primaryColorPressed: "#4939d1",
      bodyColor: "#f6f5ff",
      borderColor: "#e6e5f5",
      textColorBase: "#182033",
      borderRadius: "8px"
    });
    expect(theme.Progress?.fillColor).toBe(theme.common?.primaryColor);
  });
  it("leaves provider defaults available if a host cannot compute CSS variables", () => {
    expect(createTheme({ getPropertyValue: () => "" }).common?.primaryColor).toBeUndefined();
  });
});
