// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/check-diff-coverage.mjs", import.meta.url).href;

/**
 * 中文模块说明：工程与 Worker 脚本，负责 开发、清理、构建或发布自动化
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { coveragePolicyFor, assertDeclarationOnly } from "./source-policy.mjs";

const SOURCE_EXTENSIONS = ["*.ts", "*.tsx", "*.vue"];

function normalizeRepoPath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function parseArgs(argv) {
  const options = {
    base: process.env.DIFF_COVERAGE_BASE ?? process.env.GITHUB_BASE_SHA ?? "",
    threshold: 90,
    lcov: [],
    reportOnly: false,
    worktree: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--report-only") {
      options.reportOnly = true;
      continue;
    }
    if (argument === "--worktree") {
      options.worktree = true;
      continue;
    }
    if (argument === "--base" || argument === "--threshold" || argument === "--lcov") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a value`);
      }
      index += 1;
      if (argument === "--base") options.base = value;
      if (argument === "--threshold") options.threshold = Number(value);
      if (argument === "--lcov") options.lcov.push(value);
      continue;
    }
    if (argument.startsWith("--base=")) options.base = argument.slice("--base=".length);
    else if (argument.startsWith("--threshold=")) options.threshold = Number(argument.slice("--threshold=".length));
    else if (argument.startsWith("--lcov=")) options.lcov.push(argument.slice("--lcov=".length));
    else throw new Error(`Unknown argument: ${argument}`);
  }

  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 100) {
    throw new Error("--threshold must be a number between 0 and 100");
  }
  return options;
}

export function parseDiff(diffText) {
  const changedLines = new Map();
  let currentFile = null;
  let newLine = 0;
  let inHunk = false;

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("rename to ")) {
      currentFile = normalizeRepoPath(line.slice(10));
      inHunk = false;
      changedLines.set(currentFile, new Set());
      continue;
    }
    if (line.startsWith("+++ b/")) {
      currentFile = normalizeRepoPath(line.slice(6));
      inHunk = false;
      continue;
    }
    if (line === "+++ /dev/null") {
      currentFile = null;
      inHunk = false;
      continue;
    }

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      inHunk = Boolean(currentFile);
      if (inHunk && !changedLines.has(currentFile)) changedLines.set(currentFile, new Set());
      continue;
    }
    if (!inHunk || !currentFile || line.startsWith("\\")) continue;

    if (line.startsWith("+")) {
      changedLines.get(currentFile).add(newLine);
      newLine += 1;
    } else if (line.startsWith(" ")) {
      newLine += 1;
    }
  }

  return changedLines;
}

export function parseLcovText(lcovText, lcovPath, repoRoot) {
  // CI downloads artifacts under .coverage; SF remains relative to the original workspace.
  const normalizedReport = normalizeRepoPath(path.resolve(lcovPath));
  const workspace = normalizedReport.match(
    /\/(apps\/(?:api|web)|backend|frontend|packages\/(?:shared|runtime-core))\/coverage\/[^/]+$/
  )?.[1];
  const packageRoot = workspace ? path.resolve(repoRoot, workspace) : path.resolve(path.dirname(lcovPath), "..");
  const coverage = new Map();
  let sourceFile = null;

  for (const line of lcovText.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      const source = line.slice(3);
      const absoluteSource = path.isAbsolute(source) ? path.normalize(source) : path.resolve(packageRoot, source);
      sourceFile = normalizeRepoPath(path.relative(repoRoot, absoluteSource));
      if (!coverage.has(sourceFile)) coverage.set(sourceFile, new Map());
      continue;
    }
    const data = line.match(/^DA:(\d+),(\d+)/);
    if (data && sourceFile) coverage.get(sourceFile).set(Number(data[1]), Number(data[2]));
    if (line === "end_of_record") sourceFile = null;
  }

  return coverage;
}

function mergeCoverage(files, repoRoot) {
  const merged = new Map();
  for (const file of files) {
    const coverage = parseLcovText(file.contents, file.path, repoRoot);
    for (const [source, lines] of coverage) {
      if (!merged.has(source)) merged.set(source, new Map());
      const target = merged.get(source);
      for (const [line, hits] of lines) target.set(line, Math.max(target.get(line) ?? 0, hits));
    }
  }
  return merged;
}

export function evaluateDiffCoverage(changedLines, coverage) {
  let total = 0;
  let covered = 0;
  const files = [];
  const missing = [...changedLines.keys()].filter(
    (source) => coveragePolicyFor(source).required && !coverage.get(source)?.size
  );
  if (missing.length)
    throw new Error(`Missing LCOV coverage for changed production files:\n${missing.sort().join("\n")}`);

  for (const [source, lines] of changedLines) {
    if (!coveragePolicyFor(source).required) continue;
    const sourceCoverage = coverage.get(source);
    if (!sourceCoverage) continue;
    let fileTotal = 0;
    let fileCovered = 0;
    for (const line of lines) {
      if (!sourceCoverage.has(line)) continue;
      fileTotal += 1;
      if (sourceCoverage.get(line) > 0) fileCovered += 1;
    }
    if (fileTotal === 0) continue;
    total += fileTotal;
    covered += fileCovered;
    files.push({ source, covered: fileCovered, total: fileTotal });
  }

  return {
    covered,
    total,
    percentage: total === 0 ? 100 : (covered / total) * 100,
    files: files.sort((left, right) => left.source.localeCompare(right.source))
  };
}

function printHelp() {
  console.log(`Usage: pnpm coverage:diff --base <sha> [options]

Options:
  --base <sha>         Git PR base commit (or DIFF_COVERAGE_BASE)
  --threshold <0-100>  Minimum changed executable-line coverage (default: 90)
  --lcov <path>        LCOV file; may be supplied multiple times
  --report-only        Print the result without failing below the threshold
  --worktree           Compare the fixed base to tracked and untracked working-tree source
`);
}

export function readGitDiff(repoRoot, base, worktree) {
  const diff = (env = process.env) =>
    execFileSync(
      "git",
      [
        "-c",
        "core.quotepath=false",
        "diff",
        "--unified=0",
        "--find-renames",
        "--no-ext-diff",
        "--no-textconv",
        "--src-prefix=a/",
        "--dst-prefix=b/",
        worktree ? base : `${base}...HEAD`,
        "--diff-filter=ACMR",
        "--",
        ...SOURCE_EXTENSIONS
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        stdio: "pipe",
        env
      }
    );
  if (!worktree) return diff();

  // A private index lets Git see untracked move destinations without staging user changes.
  const root = mkdtempSync(path.join(os.tmpdir(), "toolbox-diff-index-"));
  try {
    const files = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...SOURCE_EXTENSIONS],
      {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024
      }
    )
      .split("\0")
      .filter((file) => file && existsSync(path.join(repoRoot, file)));
    const env = { ...process.env, GIT_INDEX_FILE: path.join(root, "index") };
    const run = (args) => execFileSync("git", args, { cwd: repoRoot, env, encoding: "utf8", stdio: "pipe" });
    run(["read-tree", "HEAD"]);
    for (let offset = 0; offset < files.length; offset += 40)
      run(["add", "--intent-to-add", "--", ...files.slice(offset, offset + 40)]);
    return diff(env);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-diff-index-"));
    rmSync(root, { recursive: true, force: true });
  }
}

export function resolveLcovFiles(repoRoot, requested) {
  const candidates =
    requested.length > 0
      ? requested
      : [
          existsSync(path.join(repoRoot, "apps/api/package.json"))
            ? "apps/api/coverage/lcov.info"
            : "backend/coverage/lcov.info",
          existsSync(path.join(repoRoot, "apps/web/package.json"))
            ? "apps/web/coverage/lcov.info"
            : "frontend/coverage/lcov.info",
          "packages/shared/coverage/lcov.info",
          "packages/runtime-core/coverage/lcov.info"
        ];
  const files = [];
  for (const candidate of candidates) {
    const filePath = path.resolve(repoRoot, candidate);
    try {
      files.push({ path: filePath, contents: readFileSync(filePath, "utf8") });
    } catch (error) {
      if (requested.length > 0) throw new Error(`Unable to read LCOV file ${candidate}: ${error.message}`);
    }
  }
  if (files.length === 0) throw new Error("No LCOV files found. Run pnpm coverage first.");
  return files;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }
  if (!options.base) throw new Error("A PR base commit is required via --base or DIFF_COVERAGE_BASE");

  const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const changedLines = parseDiff(readGitDiff(repoRoot, options.base, options.worktree));
  for (const source of changedLines.keys()) {
    const policy = coveragePolicyFor(source);
    if (policy.declarations) {
      const contents = options.worktree
        ? readFileSync(path.join(repoRoot, source), "utf8")
        : execFileSync("git", ["show", "HEAD:" + source], { cwd: repoRoot, encoding: "utf8", stdio: "pipe" });
      assertDeclarationOnly(source, contents);
    }
    if (!policy.required) console.log(`Outside required LCOV scope: ${source} (${policy.reason})`);
  }
  const lcovFiles = resolveLcovFiles(repoRoot, options.lcov);
  const coverage = mergeCoverage(lcovFiles, repoRoot);
  const result = evaluateDiffCoverage(changedLines, coverage);

  console.log(`Changed executable lines: ${result.covered}/${result.total} covered (${result.percentage.toFixed(2)}%)`);
  for (const file of result.files) console.log(`  ${file.source}: ${file.covered}/${file.total}`);
  if (!options.reportOnly && result.percentage < options.threshold) {
    console.error(
      `Changed-line coverage ${result.percentage.toFixed(2)}% is below the ${options.threshold}% threshold`
    );
    return 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(publicEntryUrl)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
