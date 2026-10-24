/** Shared, explicit source ownership rules for quality checks (old/new paths coexist during migration). */
import ts from "typescript";

export function normalizeSourcePath(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isTestSource(file) {
  return /(?:^|\/)(?:__tests__|e2e)\//.test(file) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
}

export function coveragePolicyFor(file) {
  file = normalizeSourcePath(file);
  if (isTestSource(file)) return { required: false, reason: "test or test fixture" };
  if (/\.d\.ts$/.test(file) || /\/types\.ts$/.test(file))
    return {
      required: false,
      declarations: true,
      reason: "declarations; AST verified to contain no runtime implementation"
    };
  if (/^(?:backend|apps\/api)\/src\/(?:server|database\/(?:cli|benchmark))\.ts$/.test(file))
    return { required: false, reason: "existing CLI entry; integration/command tests" };
  if (/^(?:frontend|apps\/web)\/src\/(?:main|app\/router)\.ts$/.test(file))
    return { required: false, reason: "existing web entry/router; browser and router tests" };
  if (/^(?:backend|frontend|apps\/(?:api|web))\/src\/.*\.(?:ts|tsx|vue)$/.test(file)) return { required: true };
  if (file === "apps/web/tooling/style-layers.ts") return { required: true };
  if (/^packages\/(?:shared|runtime-core)\/src\/.*\.tsx?$/.test(file)) return { required: true };
  return { required: false, reason: "outside Node/Web/shared LCOV scope; separate engineering or desktop tests" };
}

/** An excluded filename cannot silently acquire executable code. No source is executed here. */
export function assertDeclarationOnly(file, contents) {
  const source = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true);
  const typeOnly = (node) => {
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isEmptyStatement(node)) return true;
    if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)) return true;
    if (ts.isImportDeclaration(node)) {
      // Imports in ambient .d.ts files support module augmentation and are never emitted.
      if (file.endsWith(".d.ts")) return true;
      const clause = node.importClause;
      return Boolean(
        clause &&
        (clause.isTypeOnly ||
          (!clause.name &&
            clause.namedBindings &&
            ts.isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.length > 0 &&
            clause.namedBindings.elements.every((item) => item.isTypeOnly)))
      );
    }
    if (ts.isExportDeclaration(node)) {
      if (node.isTypeOnly) return true;
      return Boolean(
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        ((node.exportClause.elements.length === 0 && !node.moduleSpecifier) ||
          (node.exportClause.elements.length > 0 && node.exportClause.elements.every((item) => item.isTypeOnly)))
      );
    }
    return ts.isImportEqualsDeclaration(node) && node.isTypeOnly;
  };
  if (source.parseDiagnostics.length || !source.statements.every(typeOnly))
    throw new Error("Declaration-only coverage exclusion contains runtime code or invalid syntax: " + file);
}
