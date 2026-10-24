import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { cssParser, exactStyleDuplicates, expandStyles, styleFingerprint } from "./styles.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const parser = cssParser(root);
const boundary = path.join(root, "apps/web/src");

test("R11 preserves the frozen full cascade, declarations, selectors, media/container queries and import layers", async () => {
  const contract = JSON.parse(await fs.readFile(path.join(root, "docs/refactoring/r11-style-contracts.json"), "utf8"));
  assert.deepEqual(contract.layers, ["tokens", "foundation", "components"]);
  for (const entry of contract.entries) {
    const { semanticSha256, rules, declarations, atRules } = await styleFingerprint(
      await expandStyles(path.join(root, entry.file), { boundary, parser })
    );
    assert.deepEqual(
      { semanticSha256, rules, declarations, atRules },
      {
        semanticSha256: entry.expanded.semanticSha256,
        rules: entry.expanded.rules,
        declarations: entry.expanded.declarations,
        atRules: entry.expanded.atRules
      },
      entry.file
    );
  }
});

test("cascade fingerprint rejects reordered declarations, rules, changed importance or media conditions", async () => {
  const fingerprint = async (source) => (await styleFingerprint(parser.parse(source))).semanticSha256;
  const original = await fingerprint(
    "@layer foundation { @media(max-width:900px){.a {color:red;color:blue!important}.b{color:green}} }"
  );
  for (const source of [
    "@layer foundation { @media(max-width:900px){.a {color:blue!important;color:red}.b{color:green}} }",
    "@layer foundation { @media(max-width:900px){.b{color:green}.a {color:red;color:blue!important}} }",
    "@layer foundation { @media(max-width:900px){.a {color:red;color:blue}.b{color:green}} }",
    "@layer foundation { @media(max-width:901px){.a {color:red;color:blue!important}.b{color:green}} }",
    "@layer components { @media(max-width:900px){.a {color:red;color:blue!important}.b{color:green}} }"
  ])
    assert.notEqual(await fingerprint(source), original);
});

test("import expansion keeps sequential fragments inside their original layer and refuses cycles/external/traversing imports", async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-style-imports-"));
  try {
    await fs.writeFile(path.join(scratch, "a.css"), ".a{color:red}.a{color:blue}");
    await fs.writeFile(path.join(scratch, "b.css"), ".b{color:green!important}");
    const entry = path.join(scratch, "index.css");
    await fs.writeFile(
      entry,
      '@layer tokens, foundation, components; @import "./a.css" layer(foundation); @import "./b.css" layer(components);'
    );
    const expanded = await expandStyles(entry, { boundary: scratch, parser });
    assert.deepEqual(
      await styleFingerprint(expanded),
      await styleFingerprint(
        parser.parse(
          "@layer tokens, foundation, components; @layer foundation{.a{color:red}.a{color:blue}} @layer components{.b{color:green!important}}"
        )
      )
    );
    for (const source of [
      '@import "./index.css";',
      '@import "../outside.css";',
      '@import "https://example.test/style.css";'
    ]) {
      await fs.writeFile(entry, source);
      await assert.rejects(expandStyles(entry, { boundary: scratch, parser }), /Circular|escaped|Unexpected/);
    }
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
});

test("duplicate audit does not merge similar selectors across layers, containers or media conditions", () => {
  const source = parser.parse(
    "@layer foundation{.a{color:red}.a{color:red}@media(max-width:900px){.a{color:red}} @container content(max-width:900px){.a{color:red}}} @layer components{.a{color:red}}"
  );
  const duplicates = exactStyleDuplicates(source);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].earlier.selector, ".a");
  assert.equal(duplicates[0].later.parent.params, "foundation");
});

test("semantic fingerprint ignores formatting but retains string whitespace, descendant selectors and CSS token spacing", async () => {
  const fingerprint = async (source) => (await styleFingerprint(parser.parse(source))).semanticSha256;
  assert.equal(
    await fingerprint('.a {grid-template-columns:minmax(100px, 1fr);font-family:"A  B"}'),
    await fingerprint('.a {\n grid-template-columns:minmax(\n100px,\n 1fr\n);\n font-family:"A  B";\n}')
  );
  assert.notEqual(await fingerprint('.a{font-family:"A  B"}'), await fingerprint('.a{font-family:"A B"}'));
  assert.notEqual(await fingerprint(".a .b{color:red}"), await fingerprint(".a.b{color:red}"));
  assert.notEqual(await fingerprint(".a{width:calc(1px + 2px)}"), await fingerprint(".a{width:calc(1px+2px)}"));
});
