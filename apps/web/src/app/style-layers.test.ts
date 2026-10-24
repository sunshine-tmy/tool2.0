import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { compactStyleLayers } from "../../tooling/style-layers";

const requireWeb = createRequire(new URL("../../package.json", import.meta.url));
const postcss = createRequire(requireWeb.resolve("vite"))("postcss");
async function compact(css: string): Promise<string> {
  return (await postcss([compactStyleLayers()]).process(css, { from: undefined })).css;
}

describe("ordered global CSS import layers", () => {
  it("combines adjacent original layer fragments and removes only redundant registrations after the fixed order", async () => {
    const css =
      "@layer tokens,foundation,components;@layer foundation;@layer foundation{.a{color:red!important}}@layer foundation{.b{color:blue}}@layer components;@layer components{.c{color:green}}@layer components{.d{color:black}}";
    expect(await compact(css)).toBe(
      "@layer tokens,foundation,components;@layer foundation{.a{color:red!important}.b{color:blue}}@layer components{.c{color:green}.d{color:black}}"
    );
  });
  it("does nothing without the original explicit layer order", async () => {
    for (const css of [
      "@layer foundation;@layer foundation{.a{color:red}}@layer foundation{.b{color:blue}}",
      "@layer components,foundation,tokens;@layer foundation;@layer foundation{.a{color:red}}@layer foundation{.b{color:blue}}"
    ])
      expect(await compact(css)).toBe(css);
  });
  it("does not merge across unlayered rules, media queries, anonymous layers or other named layers", async () => {
    const css =
      "@layer tokens,foundation,components;@layer foundation{.a{color:red}}.outside{color:green}@layer foundation{.b{color:blue}}@media(max-width:900px){@layer foundation{.c{color:red}}}@layer{.d{color:red}}@layer other{.e{color:red}}@layer foundation{.f{color:red}}";
    expect(await compact(css)).toBe(css);
  });
  it("preserves declaration order and conditional rules inside merged blocks", async () => {
    const css =
      "@layer tokens,foundation,components;@layer foundation{.a{color:red;color:blue!important}}@layer foundation{@container content(max-width:900px){.a{color:green}}}";
    expect(await compact(css)).toBe(
      "@layer tokens,foundation,components;@layer foundation{.a{color:red;color:blue!important}@container content(max-width:900px){.a{color:green}}}"
    );
  });
  it("retains comments while folding semantically adjacent blocks", async () => {
    const css =
      "@layer tokens,foundation,components;/* keep this comment */@layer foundation{.a{color:red}}/* keep this too */@layer foundation{.b{color:blue}}";
    const result = await compact(css);
    expect(result).toContain("/* keep this comment */");
    expect(result).toContain("/* keep this too */");
    expect(result.match(/@layer foundation\{/g)).toHaveLength(1);
    expect(result).toContain(".a{color:red}.b{color:blue}");
  });
});
