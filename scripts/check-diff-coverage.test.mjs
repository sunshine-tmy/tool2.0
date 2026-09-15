import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import path from "node:path";
import { evaluateDiffCoverage, parseDiff, parseLcovText } from "./check-diff-coverage.mjs";

describe("changed-line coverage evaluation", () => {
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

  it("uses repository-relative source names for package LCOV files", async () => {
    const repoRoot = process.cwd();
    const lcovPath = path.join(repoRoot, "backend", "coverage", "lcov.info");
    const coverage = parseLcovText("SF:src\\example.ts\nDA:4,1\nend_of_record\n", lcovPath, repoRoot);
    assert.equal(coverage.get("backend/src/example.ts").get(4), 1);
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
