import ts from "typescript";
import path from "node:path";
import { isTestSource, normalizeSourcePath } from "./source-policy.mjs";

// Exact, temporary debts. Removing a dependency must also remove its entry.
const legacyEdges = [];

export function importsOf(file, contents) {
  const chunks = file.endsWith(".vue")
    ? [...contents.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1])
    : [contents];
  const result = [];
  for (const chunk of chunks) {
    const source = ts.createSourceFile(file, chunk, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier)) {
          const clause = node.importClause;
          const bindings = clause?.namedBindings;
          const onlyNamedTypes =
            bindings &&
            ts.isNamedImports(bindings) &&
            !clause.name &&
            bindings.elements.length > 0 &&
            bindings.elements.every((element) => element.isTypeOnly);
          const onlyExportTypes =
            ts.isExportDeclaration(node) &&
            node.exportClause &&
            ts.isNamedExports(node.exportClause) &&
            node.exportClause.elements.length > 0 &&
            node.exportClause.elements.every((element) => element.isTypeOnly);
          result.push({
            specifier: specifier.text,
            kind: node.isTypeOnly || clause?.isTypeOnly || onlyNamedTypes || onlyExportTypes ? "type" : "runtime"
          });
        }
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        if (node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
          result.push({ specifier: node.arguments[0].text, kind: "runtime" });
      } else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) {
        result.push({ specifier: node.argument.literal.text, kind: "type" });
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteral(node.moduleReference.expression)
      ) {
        result.push({ specifier: node.moduleReference.expression.text, kind: node.isTypeOnly ? "type" : "runtime" });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return result;
}

function owner(file) {
  if (/^(?:backend|apps\/api)\//.test(file)) return "api";
  if (/^(?:frontend|apps\/web)\//.test(file)) return "web";
  if (file.startsWith("apps/desktop/")) return "desktop";
  return null;
}

function edgeViolation(source, edge) {
  source = normalizeSourcePath(source);
  const target = edge.specifier.startsWith(".")
    ? path.posix.normalize(path.posix.join(path.posix.dirname(source), edge.specifier))
    : edge.specifier;
  const shared = source.startsWith("packages/shared/src/");
  const runtimeCore = source.startsWith("packages/runtime-core/src/");
  const node =
    /^(?:node:|electron$|(?:fs|path|os|crypto|child_process|worker_threads|stream|http|https|net|tls|url|util|events|buffer|process|module|assert|zlib|timers|readline)(?:\/|$))/.test(
      target
    );
  if (
    shared &&
    (node || owner(target) || target === "@toolbox/runtime-core" || target.startsWith("@toolbox/runtime-core/"))
  )
    return { target, reason: "shared contracts must remain browser-safe and application-independent" };
  if (runtimeCore && owner(target)) return { target, reason: "runtime-core cannot depend on application source" };
  if (
    owner(source) === "web" &&
    /\/src\//.test(source) &&
    edge.kind === "runtime" &&
    (node || target === "@toolbox/runtime-core" || target.startsWith("@toolbox/runtime-core/"))
  )
    return { target, reason: "web runtime cannot import Node/Electron" };
  if (owner(source) && owner(target) && owner(source) !== owner(target))
    return { target, reason: "cross-application source import" };
  if (
    source === "apps/desktop/src/preload.ts" &&
    edge.kind === "runtime" &&
    target !== "electron" &&
    (node || owner(target) || target === "@toolbox/runtime-core" || target.startsWith("@toolbox/runtime-core/"))
  )
    return { target, reason: "preload must keep fixed Electron capabilities without Node or app internals" };
  if (
    !isTestSource(source) &&
    /^apps\/desktop\/src\/(?:backend-supervisor|process-guard|shutdown-wait|system-proxy|startup-diagnostics|startup-progress|quit-coordinator|startup-diagnostics-page|shutdown-window|desktop-data-migration|desktop-root-migration|desktop-settings|desktop-updater|desktop-update-feed|window-security)(?:\.ts)?$/.test(
      target
    )
  )
    return {
      target,
      reason: "R09 imports must use the desktop responsibility directory, not a retired flat implementation"
    };
  if (
    !isTestSource(source) &&
    /^apps\/api\/src\/modules\/(?:image-compress|image-ai|speech|edge-tts|chatterbox|audio-library|media-archive|xhs-archive|lan-transfer|lan-access)(?:\/|\.ts$|$)/.test(
      target
    )
  )
    return { target, reason: "R07 source must use its domain/system owner, not a retired modules tree" };
  if (
    !isTestSource(source) &&
    /^apps\/api\/src\/(?:modules|domains)\/audio-library\//.test(source) &&
    /^apps\/api\/src\/(?:modules\/(?:chatterbox|edge-tts)|domains\/speech\/(?:chatterbox|edge-tts))(?:\/|$)/.test(
      target
    )
  )
    return { target, reason: "audio-library must consume speech sources through its read-only port" };
  if (/^apps\/api\/src\/core\//.test(source) && /^apps\/api\/src\/(?:domains|system)\//.test(target))
    return { target, reason: "core cannot depend on domains/system" };
  if (/^apps\/web\/src\/shared\//.test(source) && /^apps\/web\/src\/features\//.test(target))
    return { target, reason: "web shared cannot depend on features" };
  if (
    !isTestSource(source) &&
    /^apps\/web\/src\/(?:modules|pages|layouts|components|composables|services|utils|config)\//.test(target)
  )
    return { target, reason: "R08 source must use app/shell/shared/features/integrations, not a retired web tree" };
  const sourceFeature = /^apps\/web\/src\/features\/([^/]+)\//.exec(source)?.[1];
  const targetFeature = /^apps\/web\/src\/features\/([^/]+)\/(.*)/.exec(target);
  if (
    !isTestSource(source) &&
    sourceFeature &&
    targetFeature &&
    sourceFeature !== targetFeature[1] &&
    !targetFeature[2].startsWith("integrations/")
  )
    return { target, reason: "web features must use another feature's explicit integration port" };
  if (
    !isTestSource(source) &&
    /^apps\/web\/src\/features\/speech\/shared\//.test(source) &&
    /^apps\/web\/src\/features\/speech\/(?:edge-tts|chatterbox)\//.test(target)
  )
    return { target, reason: "speech shared cannot depend on an engine's private implementation" };
  if (/\/content-archive\/core\//.test(source) && /\/content-archive\/compat\//.test(target))
    return { target, reason: "archive core cannot depend on compatibility adapters" };
  return null;
}

export function checkArchitecture(files, debts = legacyEdges) {
  const used = new Set();
  const violations = [];
  for (const [source, contents] of files) {
    for (const edge of importsOf(source, contents)) {
      const violation = edgeViolation(source, edge);
      if (!violation) continue;
      const index = debts.findIndex(
        ([from, to, kind]) => from === source && to === violation.target && kind === edge.kind
      );
      if (index >= 0) used.add(index);
      else violations.push(`${source} -> ${edge.specifier} [${edge.kind}]: ${violation.reason}`);
    }
  }
  for (const [index, debt] of debts.entries())
    if (!used.has(index)) violations.push(`Stale architecture debt: ${debt[0]} -> ${debt[1]} [${debt[2]}]`);
  return violations;
}
