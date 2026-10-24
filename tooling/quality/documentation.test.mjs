import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { checkDocumentation } from "./documentation.mjs";

const empty = { schemaVersion: 1, current: [], historical: [], startupFiles: [] };

test("current documentation resolves repository links and complete startup prerequisites without Git or local data", () => {
  const root = new URL("../../", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("docs/documentation-map.json", root), "utf8"));
  const documents = new Map(
    [...manifest.current, ...manifest.historical].map((file) => [file, readFileSync(new URL(file, root), "utf8")])
  );
  assert.deepEqual(
    checkDocumentation(manifest, documents, (file) => existsSync(new URL(file, root))),
    []
  );
});

test("missing tooling in fresh-clone instructions fails even when all source files exist", () => {
  const manifest = { ...empty, current: ["README.md"], startupFiles: ["scripts/", "tooling/"] };
  const documents = new Map([["README.md", "Prepare `scripts/` before start."]]);
  assert.deepEqual(
    checkDocumentation(manifest, documents, () => true),
    ["README.md: missing startup prerequisite tooling/"]
  );
  documents.set("README.md", "Prepare `scripts/` and `tooling/` before start.");
  assert.deepEqual(
    checkDocumentation(manifest, documents, () => true),
    []
  );
  assert.deepEqual(
    checkDocumentation(manifest, documents, (file) => file !== "tooling/"),
    ["tooling/: missing startup source"]
  );
});

test("old source instructions fail while distributed resource and current workspace paths remain valid", () => {
  const manifest = { ...empty, current: ["README.md"] };
  for (const text of ["`backend/src/app.ts`", "`frontend/public`", "Run ../frontend/dist/", "backend\\src\\app.ts"]) {
    assert.match(
      checkDocumentation(manifest, new Map([["README.md", text]]), () => true).join("\n"),
      /retired source path/
    );
  }
  assert.deepEqual(
    checkDocumentation(
      manifest,
      new Map([["README.md", "`apps/api/src/app.ts` `apps/web/dist` `resources/backend/dist/`"]]),
      () => true
    ),
    []
  );
});

test("historical source paths require an explicit header and cannot also be current instructions", () => {
  const manifest = { ...empty, historical: ["docs/old.md"] };
  const documents = new Map([["docs/old.md", "> 文档状态：历史记录。\n`backend/src/old.ts`"]]);
  assert.deepEqual(
    checkDocumentation(manifest, documents, () => true),
    []
  );
  documents.set("docs/old.md", "`backend/src/old.ts`");
  assert.match(checkDocumentation(manifest, documents, () => true)[0], /missing historical status/);
  assert.match(
    checkDocumentation({ ...manifest, current: manifest.historical }, documents, () => true)[0],
    /ambiguous/
  );
});

test("local links detect missing or escaping targets and accept anchors, URLs and encoded spaces", () => {
  const manifest = { ...empty, current: ["docs/guide.md"] };
  const documents = new Map([
    [
      "docs/guide.md",
      "[ok](../README.md#start) [space](<a%20b.md>) [web](https://example.com) [local](#start) [bad](missing.md) [escape](../../outside.md)"
    ]
  ]);
  assert.deepEqual(
    checkDocumentation(manifest, documents, (file) => ["README.md", "docs/a b.md"].includes(file)),
    ["docs/guide.md: broken local link missing.md", "docs/guide.md: broken local link ../../outside.md"]
  );
  assert.deepEqual(
    checkDocumentation(manifest, new Map(), () => true),
    ["docs/guide.md: missing current document"]
  );
  assert.throws(() => checkDocumentation({ ...empty, schemaVersion: 2 }, new Map(), () => true), /Unsupported/);
});
