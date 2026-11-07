import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses defined design tokens for the video workspace, settings and history", () => {
  const tokens = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");
  const defined = new Set(Array.from(tokens.matchAll(/(--[\w-]+)\s*:/g), (match) => match[1]));
  for (const name of ["page.vue", "VideoWorkspace.vue", "VideoProcessingPanel.vue", "VideoHistoryPanel.vue"]) {
    const source = readFileSync(new URL(name, import.meta.url), "utf8");
    const style = source.slice(source.indexOf("<style scoped>"));
    const missing = Array.from(style.matchAll(/var\((--[\w-]+)\)/g), (match) => match[1]).filter(
      (token) => !defined.has(token)
    );
    expect(missing, `${name} references undefined design tokens`).toEqual([]);
  }
});
