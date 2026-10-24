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
