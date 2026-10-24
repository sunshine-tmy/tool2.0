/**
 * 中文模块说明：测试 scripts/check-diff-coverage.test.mjs 中的稳定行为、边界条件和回归场景
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  evaluateDiffCoverage,
  parseDiff,
  parseLcovText,
  readGitDiff,
  resolveLcovFiles
} from "./check-diff-coverage.mjs";
import { coveragePolicyFor, assertDeclarationOnly } from "../tooling/quality/source-policy.mjs";

async function gitFixture(run, { unchanged = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-diff-fixture-"));
  const hooks = path.join(root, "empty-hooks");
  const git = (...args) =>
    execFileSync(
      "git",
      ["-c", "core.autocrlf=false", "-c", "commit.gpgsign=false", "-c", `core.hooksPath=${hooks}`, ...args],
      {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe"
      }
    ).trim();
  const put = async (file, content) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  };
  try {
    await fs.mkdir(hooks);
    git("init", "-q");
    git("config", "core.autocrlf", "false");
    const original = Array.from({ length: 40 }, (_, i) => `export const field${i} = ${i};`).join("\n") + "\n";
    const retained = Array.from({ length: 40 }, (_, i) => `export const retained${i} = '${i}';`).join("\n") + "\n";
    await put("frontend/src/page.ts", original);
    await put("frontend/src/retained.ts", retained);
    git("add", ".");
    git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture baseline");
    const base = git("rev-parse", "HEAD");
    await fs.mkdir(path.join(root, "apps/web/src"), { recursive: true });
    await fs.rename(path.join(root, "frontend/src/page.ts"), path.join(root, "apps/web/src/page.ts"));
    const index = await fs.readFile(path.join(root, ".git/index"));
    await run({ root, git, put, base, original, retained });
    if (unchanged) assert.deepEqual(await fs.readFile(path.join(root, ".git/index")), index);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-diff-fixture-"));
    await fs.rm(root, { recursive: true, force: true });
  }
}

describe("real Git relocation coverage", () => {
  it("counts no executable changes for a pure move but still requires its LCOV", () =>
    gitFixture(async ({ root, base }) => {
      const changed = parseDiff(readGitDiff(root, base, true));
      assert.deepEqual([...changed.get("apps/web/src/page.ts")], []);
      assert.throws(() => evaluateDiffCoverage(changed, new Map()), /Missing LCOV/);
      assert.equal(evaluateDiffCoverage(changed, new Map([["apps/web/src/page.ts", new Map([[1, 0]])]])).total, 0);
    }));
  it("keeps moved edits uncovered, and counts new and copied files in full", () =>
    gitFixture(async ({ root, base, put, original, retained }) => {
      await put("apps/web/src/page.ts", original.replace("field9 = 9", "field9 = 999"));
      await put("apps/web/src/new.ts", "export const fresh = 1;\n");
      await put("apps/web/src/copied.ts", retained);
      const changed = parseDiff(readGitDiff(root, base, true));
      assert.deepEqual([...changed.get("apps/web/src/page.ts")], [10]);
      assert.deepEqual([...changed.get("apps/web/src/new.ts")], [1]);
      assert.equal(changed.get("apps/web/src/copied.ts").size, 40);
      assert.equal(
        evaluateDiffCoverage(
          new Map([["apps/web/src/page.ts", changed.get("apps/web/src/page.ts")]]),
          new Map([["apps/web/src/page.ts", new Map([[10, 0]])]])
        ).percentage,
        0
      );
    }));
  it("uses committed content for PR checks and preserves staged user entries in worktree checks", () =>
    gitFixture(
      async ({ root, git, put, base, original }) => {
        await put("apps/web/src/page.ts", original.replace("field9 = 9", "field9 = 999"));
        git("add", "-A");
        git(
          "-c",
          "user.name=Fixture",
          "-c",
          "user.email=fixture@example.invalid",
          "commit",
          "-qm",
          "fixture relocation"
        );
        await put(
          "apps/web/src/page.ts",
          original.replace("field9 = 9", "field9 = 999").replace("field10 = 10", "field10 = 1000")
        );
        await put("apps/web/src/staged.ts", "export const staged = 1;\n");
        git("add", "apps/web/src/staged.ts");
        const index = await fs.readFile(path.join(root, ".git/index"));
        const committed = parseDiff(readGitDiff(root, base, false));
        assert.deepEqual([...committed.get("apps/web/src/page.ts")], [10]);
        assert.equal(committed.has("apps/web/src/staged.ts"), false);
        const working = parseDiff(readGitDiff(root, base, true));
        assert.deepEqual([...working.get("apps/web/src/page.ts")], [10, 11]);
        assert.deepEqual([...working.get("apps/web/src/staged.ts")], [1]);
        assert.deepEqual(await fs.readFile(path.join(root, ".git/index")), index);
      },
      { unchanged: false }
    ));
  it("fails on an invalid base without touching the real index", () =>
    gitFixture(async ({ root }) => {
      assert.throws(() => readGitDiff(root, "missing-fixture-base", true));
    }));
});

describe("changed-line coverage evaluation", () => {
  it("accepts only erased declarations and type imports in reviewed declaration files", () => {
    assert.doesNotThrow(() =>
      assertDeclarationOnly(
        "fixture/augmentation.d.ts",
        'import "archiver"; declare module "archiver" { export type Fixture = string; }'
      )
    );
    for (const source of [
      "import type { X } from './x'; export type Options = { value: X };",
      "import { type X } from './x'; export interface Options { value: X }",
      "export type { X } from './x'; export type * from './x';",
      "declare global { interface Window { value: string } } export {};"
    ])
      assert.doesNotThrow(() => assertDeclarationOnly("fixture/types.ts", source));
  });
  it("rejects executable code and side effects hidden behind declaration filenames", () => {
    for (const source of [
      "export const value = 1;",
      "export function value() { return 1; }",
      "import './side-effect'; export type T = string;",
      "import { value } from './side-effect'; export type T = typeof value;",
      "export {} from './side-effect';",
      "export type T = ;"
    ])
      assert.throws(() => assertDeclarationOnly("fixture/types.ts", source), /runtime code or invalid syntax/);
  });
  it("does not expand exclusions for options, contexts or similarly named production files", () => {
    for (const source of [
      "apps/api/src/app/options.ts",
      "apps/api/src/core/config/context.ts",
      "apps/web/tooling/style-layers.ts"
    ])
      assert.equal(coveragePolicyFor(source).required, true);
    for (const source of ["apps/api/src/domains/image/options.ts", "apps/api/src/modules/image-ai/context.ts"])
      assert.equal(coveragePolicyFor(source).required, true);
  });
  it("CLI validates declarations before excluding phantom LCOV lines", () =>
    gitFixture(async ({ root, base, put }) => {
      const declaration = "apps/api/src/core/config/types.ts";
      await put(declaration, "export type Options = { value: string };\n");
      const report = path.join(root, "fixture-lcov.info");
      await fs.writeFile(
        report,
        "SF:" +
          path.join(root, "apps/web/src/page.ts") +
          "\nDA:1,1\nend_of_record\nSF:" +
          path.join(root, declaration) +
          "\nDA:1,0\nend_of_record\n"
      );
      const script = fileURLToPath(new URL("./check-diff-coverage.mjs", import.meta.url));
      const run = () =>
        execFileSync(process.execPath, [script, "--base", base, "--worktree", "--lcov", report], {
          cwd: root,
          encoding: "utf8",
          stdio: "pipe"
        });
      assert.match(run(), /0\/0 covered \(100.00%\)/);
      await put(declaration, "export const hiddenRuntime = 1;\n");
      assert.throws(run, (error) =>
        /Declaration-only coverage exclusion contains runtime code/.test(String(error.stderr))
      );
    }));
  it("never falls back to stale legacy reports after an application has moved", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-lcov-layout-"));
    try {
      await fs.mkdir(path.join(root, "backend/coverage"), { recursive: true });
      await fs.writeFile(path.join(root, "backend/coverage/lcov.info"), "legacy");
      assert.equal(resolveLcovFiles(root, [])[0].contents, "legacy");
      await fs.mkdir(path.join(root, "apps/api/coverage"), { recursive: true });
      await fs.writeFile(path.join(root, "apps/api/package.json"), "{}");
      assert.throws(() => resolveLcovFiles(root, []), /No LCOV files/);
      await fs.writeFile(path.join(root, "apps/api/coverage/lcov.info"), "current");
      assert.deepEqual(
        resolveLcovFiles(root, []).map((report) => report.contents),
        ["current"]
      );
      assert.equal(resolveLcovFiles(root, ["backend/coverage/lcov.info"])[0].contents, "legacy");
      await fs.mkdir(path.join(root, "frontend/coverage"), { recursive: true });
      await fs.writeFile(path.join(root, "frontend/coverage/lcov.info"), "legacy-web");
      assert.deepEqual(
        resolveLcovFiles(root, []).map((report) => report.contents),
        ["current", "legacy-web"]
      );
      await fs.mkdir(path.join(root, "apps/web/coverage"), { recursive: true });
      await fs.writeFile(path.join(root, "apps/web/package.json"), "{}");
      assert.deepEqual(
        resolveLcovFiles(root, []).map((report) => report.contents),
        ["current"]
      );
      await fs.writeFile(path.join(root, "apps/web/coverage/lcov.info"), "current-web");
      assert.deepEqual(
        resolveLcovFiles(root, []).map((report) => report.contents),
        ["current", "current-web"]
      );
    } finally {
      assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
      assert.ok(path.basename(root).startsWith("toolbox-lcov-layout-"));
      await fs.rm(root, { recursive: true, force: true });
    }
  });
  it("rejects missing LCOV instead of reporting a false 100% for an uninstrumented Vue or TS file", () => {
    for (const source of [
      "frontend/src/modules/new/page.vue",
      "apps/web/src/features/new/page.vue",
      "apps/api/src/domains/new/service.ts",
      "packages/shared/src/worker-protocol.ts"
    ]) {
      assert.throws(() => evaluateDiffCoverage(new Map([[source, new Set([1])]]), new Map()), /Missing LCOV/);
      assert.throws(
        () => evaluateDiffCoverage(new Map([[source, new Set([1])]]), new Map([[source, new Map()]])),
        /Missing LCOV/
      );
    }
  });

  it("accepts genuinely covered production changes and rejects absent reports even with other reports present", () => {
    const source = "frontend/src/modules/new/page.vue";
    const changed = new Map([[source, new Set([1, 2])]]);
    assert.equal(
      evaluateDiffCoverage(
        changed,
        new Map([
          [
            source,
            new Map([
              [1, 1],
              [2, 1]
            ])
          ]
        ])
      ).percentage,
      100
    );
    assert.throws(
      () => evaluateDiffCoverage(changed, new Map([["frontend/src/unrelated.ts", new Map([[1, 1]])]])),
      /Missing LCOV/
    );
  });

  it("documents existing entry/type/test exclusions and never treats regular domain code as an entry", () => {
    for (const source of [
      "frontend/src/main.ts",
      "backend/src/database/cli.ts",
      "frontend/src/desktop-api.d.ts",
      "frontend/src/modules/lan-transfer/types.ts",
      "frontend/src/modules/image-ai/page.test.ts"
    ]) {
      assert.equal(coveragePolicyFor(source).required, false);
      assert.ok(coveragePolicyFor(source).reason);
      assert.equal(evaluateDiffCoverage(new Map([[source, new Set([1])]]), new Map()).total, 0);
    }
    assert.equal(coveragePolicyFor("backend/src/database/toolbox-database.ts").required, true);
    assert.equal(coveragePolicyFor("frontend\\src\\modules\\image-ai\\page.vue").required, true);
  });
  it("counts only executable changed lines and preserves uncovered lines", () => {
    const changedLines = new Map([["backend/src/example.ts", new Set([10, 11, 12, 20])]]);
    const coverage = new Map([
      [
        "backend/src/example.ts",
        new Map([
          [10, 1],
          [11, 0],
          [20, 3]
        ])
      ]
    ]);

    assert.deepEqual(evaluateDiffCoverage(changedLines, coverage), {
      covered: 2,
      total: 3,
      percentage: (2 / 3) * 100,
      files: [{ source: "backend/src/example.ts", covered: 2, total: 3 }]
    });
  });

  it("applies the existing exclusion policy even when V8 emits phantom LCOV lines", () => {
    const source = "apps/api/src/core/config/types.ts";
    assert.equal(coveragePolicyFor(source).required, false);
    const result = evaluateDiffCoverage(
      new Map([[source, new Set([1, 2])]]),
      new Map([
        [
          source,
          new Map([
            [1, 0],
            [2, 0]
          ])
        ]
      ])
    );
    assert.equal(result.total, 0);
    assert.equal(result.percentage, 100);
  });

  it("uses repository-relative source names for package LCOV files", async () => {
    const repoRoot = process.cwd();
    const lcovPath = path.join(repoRoot, "backend", "coverage", "lcov.info");
    const coverage = parseLcovText("SF:src\\example.ts\nDA:4,1\nend_of_record\n", lcovPath, repoRoot);
    assert.equal(coverage.get("backend/src/example.ts").get(4), 1);
    for (const workspace of [
      "backend",
      "frontend",
      "apps/api",
      "apps/web",
      "packages/shared",
      "packages/runtime-core"
    ]) {
      const artifact = path.join(repoRoot, ".coverage", workspace, "coverage", "lcov.info");
      const downloaded = parseLcovText("SF:src/example.ts\nDA:4,1\nend_of_record\n", artifact, repoRoot);
      assert.equal(downloaded.get(`${workspace}/src/example.ts`).get(4), 1);
    }
  });

  it("extracts added lines from zero-context git hunks", () => {
    const diff = [
      "diff --git a/backend/src/example.ts b/backend/src/example.ts",
      "--- a/backend/src/example.ts",
      "+++ b/backend/src/example.ts",
      "@@ -10,2 +10,3 @@",
      " const existing = true;",
      "+const added = false;",
      " const next = true;"
    ].join("\n");
    const changed = parseDiff(diff);
    assert.deepEqual([...changed.get("backend/src/example.ts")], [11]);
  });
});
