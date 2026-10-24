/** Read-only documentation checks; historical evidence is never treated as current instructions. */
import path from "node:path";

export function checkDocumentation(manifest, documents, exists) {
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported documentation map");
  const errors = [];
  const current = new Set(manifest.current);
  for (const file of manifest.historical) {
    if (current.has(file)) errors.push(`${file}: ambiguous current/historical classification`);
    const text = documents.get(file);
    if (!text?.slice(0, 1000).includes("> 文档状态：历史记录。"))
      errors.push(`${file}: missing historical status header`);
  }
  for (const file of current) {
    const text = documents.get(file);
    if (text === undefined) {
      errors.push(`${file}: missing current document`);
      continue;
    }
    if (
      /(?<![\w/\\-])(?:\.\.?[/\\])?(?:backend|frontend)[/\\](?:src|public|dist|coverage|package\.json)(?:[/\\\s`"']|$)/m.test(
        text
      )
    )
      errors.push(`${file}: retired source path in current instructions`);
    for (const match of text.matchAll(/\]\((?:<([^>\n]+)>|([^\s)]+))(?:\s+["'][^)]*)?\)/g)) {
      const href = match[1] ?? match[2];
      if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(href)) continue;
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(file), decodeURIComponent(href.split("#")[0]))
      );
      if (target.startsWith("../") || !exists(target)) errors.push(`${file}: broken local link ${href}`);
    }
  }
  const readme = documents.get("README.md") ?? "";
  for (const file of manifest.startupFiles) {
    if (!exists(file)) errors.push(`${file}: missing startup source`);
    if (!readme.includes(`\`${file}\``)) errors.push(`README.md: missing startup prerequisite ${file}`);
  }
  return errors;
}
