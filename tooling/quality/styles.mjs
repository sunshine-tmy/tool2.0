/** Equivalence checks for the R11 cascade. Uses the same CSS parser already shipped with Vite. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { format } from "prettier";

export function cssParser(repositoryRoot) {
  const requireWeb = createRequire(path.join(repositoryRoot, "apps/web/package.json"));
  return createRequire(requireWeb.resolve("vite"))("postcss");
}

export async function expandStyles(entry, { boundary, parser, stack = [] }) {
  entry = path.resolve(entry);
  const relative = path.relative(boundary, entry);
  if (relative.startsWith("..") || path.isAbsolute(relative) || path.extname(entry) !== ".css")
    throw new Error("CSS import escaped source boundary");
  if (stack.includes(entry)) throw new Error("Circular CSS import: " + entry);
  const root = parser.parse(await readFile(entry, "utf8"), { from: entry });
  for (const node of [...root.nodes]) {
    if (node.type !== "atrule" || node.name !== "import") continue;
    const match = /^"([^"\n]+)"(?:\s+layer\(([^)]+)\))?$/.exec(node.params);
    if (!match || !match[1].startsWith(".")) throw new Error("Unexpected CSS import: " + node.params);
    const child = await expandStyles(path.resolve(path.dirname(entry), match[1]), {
      boundary,
      parser,
      stack: [...stack, entry]
    });
    if (match[2]) {
      const layer = parser.atRule({ name: "layer", params: match[2] });
      layer.append(child.nodes.map((childNode) => childNode.clone()));
      node.replaceWith(layer);
    } else node.replaceWith(...child.nodes.map((childNode) => childNode.clone()));
  }
  return root;
}

export async function styleFingerprint(root) {
  root = root.clone();
  root.walkComments((node) => node.remove());
  const normalized = await format(root.toString(), { parser: "css" });
  const counts = { rules: 0, declarations: 0, atRules: 0 };
  root.walk((node) => {
    if (node.type === "rule") counts.rules++;
    if (node.type === "decl") counts.declarations++;
    if (node.type === "atrule") counts.atRules++;
  });
  return {
    sha256: createHash("sha256").update(normalized).digest("hex"),
    semanticSha256: createHash("sha256")
      .update(JSON.stringify(styleStructure(root)))
      .digest("hex"),
    ...counts
  };
}

/** Ignore formatting whitespace only; retain whitespace inside strings and selector descendant combinators. */
function cssText(value) {
  let output = "",
    quote = "",
    escaped = false,
    gap = false;
  for (const char of value ?? "") {
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      if (gap) {
        output += " ";
        gap = false;
      }
      output += char;
      escaped = true;
      continue;
    }
    if (quote) {
      output += char;
      if (char === quote) quote = "";
      continue;
    }
    if (/\s/.test(char)) {
      if (output) gap = true;
      continue;
    }
    if (gap) {
      if (!["(", ","].includes(output.at(-1)) && ![")", ","].includes(char)) output += " ";
      gap = false;
    }
    output += char;
    if (char === '"' || char === "'") quote = char;
  }
  return output;
}

function styleStructure(root) {
  return root.nodes
    .filter((node) => node.type !== "comment")
    .map((node) => {
      if (node.type === "decl") return ["decl", node.prop, cssText(node.value), Boolean(node.important)];
      if (node.type === "rule") return ["rule", cssText(node.selector), styleStructure(node)];
      if (node.type === "atrule")
        return ["atrule", node.name, cssText(node.params), node.nodes ? styleStructure(node) : null];
      throw new Error("Unexpected CSS node: " + node.type);
    });
}

/** Validate each reviewed post-R11 change, then reconstruct the frozen cascade on a clone. */
export function restoreReviewedStyleBaseline(root, { repositoryRoot, entryFile, amendments }) {
  const restored = root.clone();
  const origin = (node) =>
    node.source?.input.file && path.relative(repositoryRoot, node.source.input.file).replaceAll("\\", "/");
  for (const amendment of amendments.filter((item) => item.entries.includes(entryFile))) {
    const fail = (detail) => {
      throw new Error(`Reviewed style change ${amendment.id}: ${detail}`);
    };
    if (amendment.kind === "layer-addition") {
      // A deliberate visual redesign is an exact, appended layer, not a reset of R11's frozen inputs.
      // Validate every node, its source, ordering and complete structure before removing only this layer on the clone.
      const layers = restored.nodes.filter(
        (node) =>
          node.type === "atrule" &&
          node.name === "layer" &&
          node.nodes &&
          node.nodes.some((child) => origin(child) === amendment.file)
      );
      if (layers.length !== 1) fail("expected exactly one appended layer");
      const layer = layers[0];
      if (layer.params !== amendment.layer || restored.nodes.filter((node) => node.type !== "comment").at(-1) !== layer)
        fail("layer moved from its reviewed final position");
      layer.walk((node) => {
        if (node.type !== "comment" && origin(node) !== amendment.file) fail("unexpected source inside reviewed layer");
      });
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(styleStructure(layer)))
        .digest("hex");
      if (fingerprint !== amendment.semanticSha256) fail("reviewed layer structure changed");
      layer.remove();
      continue;
    }
    const matches = [];
    restored.walkRules((rule) => {
      if (origin(rule) === amendment.file && cssText(rule.selector) === cssText(amendment.selector)) matches.push(rule);
    });
    if (matches.length !== 1) fail("expected exactly one rule in its declared source file");
    const rule = matches[0];
    const parents = [];
    for (let parent = rule.parent; parent.type !== "root"; parent = parent.parent)
      parents.unshift([parent.type, parent.name, cssText(parent.params)]);
    const expectedParents = entryFile === "apps/web/src/styles/index.css" ? [["atrule", "layer", amendment.layer]] : [];
    if (JSON.stringify(parents) !== JSON.stringify(expectedParents)) fail("unexpected layer or media/container scope");
    const nodes = rule.nodes.filter((node) => node.type !== "comment");
    if (nodes.some((node) => node.type !== "decl")) fail("unexpected nested node");
    const declarations = nodes.map((node) => [node.prop, cssText(node.value), Boolean(node.important)]);
    const expected = amendment.declarations.map(([prop, value, important]) => [prop, cssText(value), important]);
    if (JSON.stringify(declarations) !== JSON.stringify(expected)) fail("declarations, order or importance changed");
    const siblings = rule.parent.nodes.filter((node) => node.type !== "comment" && origin(node) === amendment.file);
    const index = siblings.indexOf(rule);
    for (const [offset, selector] of [
      [-1, amendment.previous],
      [1, amendment.next]
    ]) {
      const sibling = siblings[index + offset];
      if (
        selector === null
          ? Boolean(sibling)
          : sibling?.type !== "rule" || cssText(sibling.selector) !== cssText(selector)
      )
        fail("rule moved from its reviewed source position");
    }
    if (amendment.baselineSelector === null) rule.remove();
    else rule.selector = amendment.baselineSelector;
  }
  return restored;
}

/** Conservative candidates only: same declarations, selector and enclosing conditions/layers. */
export function exactStyleDuplicates(root) {
  const seen = new Map();
  const duplicates = [];
  root.walkRules((rule) => {
    if (rule.nodes.some((node) => !["decl", "comment"].includes(node.type))) return;
    const context = [];
    for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent)
      context.unshift([parent.type, parent.name, parent.params]);
    const key = JSON.stringify([
      context,
      rule.selector,
      rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value, Boolean(node.important)])
    ]);
    const previous = seen.get(key);
    if (previous) duplicates.push({ earlier: previous, later: rule });
    seen.set(key, rule);
  });
  return duplicates;
}
