import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("AI 图片工作区布局", () => {
  it("参数卡片自然顶对齐，不受标签页内 sticky 偏移影响", () => {
    const css = readFileSync(resolve("src/features/image-ai/styles/foundation.css"), "utf8");
    const controls = css.match(/\.image-ai-controls\s*\{([^}]+)\}/)?.[1];
    expect(controls).toContain("position: static");
    expect(controls).toContain("align-self: start");
    expect(controls).toContain("min-width: 0");
    expect(controls).not.toMatch(/\btop\s*:/);
    expect(css).toMatch(/\.image-ai-tab-grid\s*\{[^}]*align-items: start/s);
  });

  it("窄屏时参数卡片仍使用单列自然布局", () => {
    const css = readFileSync(resolve("src/styles/foundation/responsive.css"), "utf8");
    const responsive = css.slice(css.indexOf("@media (max-width: 1180px)"));
    expect(responsive).toMatch(/\.image-ai-tab-grid\s*\{\s*grid-template-columns: 1fr;/);
    expect(responsive).toMatch(/\.image-ai-controls\s*\{\s*position: static;/);
  });
});
