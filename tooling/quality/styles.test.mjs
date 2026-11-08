import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

test("the cleaned UI v2 cascade preserves its exact structure and immutable historical R11 contract", async () => {
  const contract = JSON.parse(
    await fs.readFile(path.join(root, "docs/refactoring/2026-11-08-style-cleanup-contracts.json"), "utf8")
  );
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.historicalContract, "r11-style-contracts.json");
  const historical = await fs.readFile(path.join(root, "docs/refactoring", contract.historicalContract), "utf8");
  assert.equal(
    createHash("sha256").update(JSON.stringify(JSON.parse(historical))).digest("hex"),
    contract.historicalSha256
  );
  assert.deepEqual(contract.layers, ["tokens", "foundation", "components"]);
  for (const entry of contract.entries) {
    const { semanticSha256, rules, declarations, atRules } = await styleFingerprint(
      await expandStyles(path.join(root, entry.file), { boundary, parser })
    );
    assert.deepEqual(
      { semanticSha256, rules, declarations, atRules },
      {
        semanticSha256: entry.semanticSha256,
        rules: entry.rules,
        declarations: entry.declarations,
        atRules: entry.atRules
      },
      entry.file
    );
  }
});

test("removed legacy classes have no production template or script consumers", async () => {
  const { removedClasses } = JSON.parse(
    await fs.readFile(path.join(root, "docs/refactoring/2026-11-08-style-cleanup-contracts.json"), "utf8")
  );
  for (const relative of await fs.readdir(boundary, { recursive: true })) {
    if (!/\.(?:vue|ts)$/.test(relative) || /\.test\.ts$/.test(relative)) continue;
    const source = (await fs.readFile(path.join(boundary, relative), "utf8")).replace(/<style[\s\S]*?<\/style>/g, "");
    for (const name of removedClasses)
      assert.ok(!source.includes(name), `${relative}: removed class ${name} is in use`);
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
  const restore = (tree) =>
    restoreReviewedStyleBaseline(tree, {
      repositoryRoot: root,
      entryFile,
      amendments
    });
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

test("a reviewed redesign layer validates its entire structure and final position before restoring the historical cascade", async () => {
  const file = "apps/web/src/styles/ui-v2.css";
  const source = ":root{--ink:purple}@media(max-width:560px){.workbench{gap:16px}}";
  const child = parser.parse(source, { from: path.join(root, file) });
  const amendment = {
    id: "ui-v2-fixture",
    kind: "layer-addition",
    file,
    entries: ["apps/web/src/styles/index.css"],
    layer: "components",
    semanticSha256: (await styleFingerprint(child)).semanticSha256
  };
  const before = parser.parse("@layer tokens, foundation, components;@layer foundation{.legacy{color:blue}}", {
    from: path.join(root, "apps/web/src/styles/index.css")
  });
  const build = (css = source, origin = file) => {
    const tree = before.clone();
    const layer = parser.atRule({ name: "layer", params: "components" });
    layer.append(parser.parse(css, { from: path.join(root, origin) }).nodes);
    tree.append(layer);
    return tree;
  };
  const restore = (tree) =>
    restoreReviewedStyleBaseline(tree, {
      repositoryRoot: root,
      entryFile: amendment.entries[0],
      amendments: [amendment]
    });
  const current = build();
  assert.equal(
    (await styleFingerprint(restore(current))).semanticSha256,
    (await styleFingerprint(before)).semanticSha256
  );
  assert.equal(current.nodes.length, before.nodes.length + 1, "production AST is untouched");
  for (const css of [
    source.replace("purple", "red"),
    source.replace("560", "561"),
    source.replace("16px", "16px!important"),
    source + ".extra{color:red}"
  ])
    assert.throws(() => restore(build(css)), /reviewed layer structure changed/);
  assert.throws(() => restore(build(source, "apps/web/src/styles/other.css")), /expected exactly one/);
  const moved = build();
  moved.prepend(moved.last);
  assert.throws(() => restore(moved), /final position/);
  const duplicate = build();
  duplicate.append(duplicate.last.clone());
  assert.throws(() => restore(duplicate), /exactly one/);
  assert.throws(() => restore(before), /exactly one/);
  const changed = build();
  changed.first.params = "components, foundation, tokens";
  assert.notEqual(
    (await styleFingerprint(restore(changed))).semanticSha256,
    (await styleFingerprint(before)).semanticSha256,
    "unreviewed historical changes remain visible"
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
