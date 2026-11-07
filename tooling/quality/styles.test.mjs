import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  cssParser,
  exactStyleDuplicates,
  expandStyles,
  restoreReviewedStyleBaseline,
  styleFingerprint
} from "./styles.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const parser = cssParser(root);
const boundary = path.join(root, "apps/web/src");

test("R11 preserves its frozen cascade plus individually reviewed later fixes, without replacing the original hashes", async () => {
  const contract = JSON.parse(await fs.readFile(path.join(root, "docs/refactoring/r11-style-contracts.json"), "utf8"));
  const amendments = JSON.parse(
    await fs.readFile(path.join(root, "docs/refactoring/r11-style-amendments.json"), "utf8")
  );
  assert.equal(amendments.schemaVersion, 1);
  assert.equal(amendments.baseline, "r11-style-contracts.json");
  assert.deepEqual(contract.layers, ["tokens", "foundation", "components"]);
  for (const entry of contract.entries) {
    const { semanticSha256, rules, declarations, atRules } = await styleFingerprint(
      restoreReviewedStyleBaseline(await expandStyles(path.join(root, entry.file), { boundary, parser }), {
        repositoryRoot: root,
        entryFile: entry.file,
        amendments: amendments.amendments
      })
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

test("reviewed style changes reject altered values, important, order, scope, file, position, missing and duplicate rules", async () => {
  const entryFile = "apps/web/src/styles/redesign.css";
  const file = "apps/web/src/styles/components/fixture.css";
  const amendments = [
    {
      id: "fixture",
      entries: [entryFile, "apps/web/src/styles/index.css"],
      file,
      layer: "components",
      selector: ".reviewed",
      previous: ".before",
      next: ".after",
      declarations: [
        ["top", "var(--height, 0px)", true],
        ["color", "red", false]
      ],
      baselineSelector: null
    }
  ];
  const rule = ".reviewed{top:var(--height, 0px)!important;color:red}";
  const source = `.before{color:blue}${rule}.after{color:green}`;
  const parse = (css, from = file) => parser.parse(css, { from: path.join(root, from) });
  const restore = (tree) => restoreReviewedStyleBaseline(tree, { repositoryRoot: root, entryFile, amendments });
  const tree = parse(source);
  assert.equal(
    (await styleFingerprint(restore(tree))).semanticSha256,
    (await styleFingerprint(parse(".before{color:blue}.after{color:green}"))).semanticSha256
  );
  assert.equal(tree.toString(), source, "validation must not mutate production CSS");
  const restoreIndex = (tree) =>
    restoreReviewedStyleBaseline(tree, {
      repositoryRoot: root,
      entryFile: "apps/web/src/styles/index.css",
      amendments
    });
  assert.equal(
    (await styleFingerprint(restoreIndex(parse(`@layer components{${source}}`)))).semanticSha256,
    (await styleFingerprint(parse("@layer components{.before{color:blue}.after{color:green}}"))).semanticSha256
  );
  assert.throws(() => restoreIndex(parse(source)), /unexpected layer/);
  for (const changed of [
    source.replace("0px", "1px"),
    source.replace("!important", ""),
    source.replace("top:var(--height, 0px)!important;color:red", "color:red;top:var(--height, 0px)!important"),
    `@media(max-width:900px){${source}}`,
    `@layer foundation{${source}}`,
    source.replace(rule, ""),
    source.replace(rule, rule + rule),
    `${rule}.before{color:blue}.after{color:green}`,
    source.replace(".reviewed", ".other"),
    source.replace("color:red", "color:red;.nested{color:blue}")
  ])
    assert.throws(() => restore(parse(changed)), /Reviewed style change/);
  assert.throws(() => restore(parse(source, "apps/web/src/styles/components/other.css")), /declared source file/);
  const unrelated = parse(source + ".unreviewed{color:purple}");
  assert.notEqual(
    (await styleFingerprint(restore(unrelated))).semanticSha256,
    (await styleFingerprint(restore(tree))).semanticSha256,
    "unreviewed changes must remain visible to the frozen fingerprint"
  );
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
