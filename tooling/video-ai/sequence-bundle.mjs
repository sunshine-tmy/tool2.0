/** Build the pinned inference closure only; no dependency install, signing or activation. */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const lockUrl = new URL("./sequence-sources.json", import.meta.url);
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

export function isolateImports(source, relative) {
  const parent = relative.split("/").slice(0, -1);
  return source.replace(/^from ((?:model|core|RAFT)(?:\.[\w]+)*) import (.+)$/gm, (_line, name, imports) => {
    const target = name.split(".");
    let common = 0;
    while (common < parent.length && parent[common] === target[common]) common++;
    return `from ${".".repeat(parent.length - common + 1)}${target.slice(common).join(".")} import ${imports}`;
  });
}

async function readOwned(root, relative, expected) {
  let current = root;
  for (const part of relative.split("/")) {
    if (!part || part === "." || part === ".." || /[:\\]/.test(part)) throw new Error("Unsafe sequence asset path");
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("Sequence assets cannot contain links/junctions");
  }
  const bytes = await fs.readFile(current);
  if (hash(bytes) !== expected.sha256 || (expected.bytes !== undefined && bytes.length !== expected.bytes))
    throw new Error(`Sequence asset digest mismatch: ${relative}`);
  return bytes;
}

export async function stageSequenceBundle({ cacheRoot, destination, engine, manifest, adapterReady = false }) {
  if (typeof adapterReady !== "boolean") throw new Error("adapterReady must be an explicit boolean");
  manifest ??= JSON.parse(await fs.readFile(lockUrl, "utf8"));
  const entry = manifest.engines[engine];
  if (manifest.schemaVersion !== 1 || !["sttn", "propainter"].includes(engine) || !entry)
    throw new Error("Unsupported sequence engine");
  const root = path.resolve(cacheRoot);
  if ((await fs.lstat(root)).isSymbolicLink()) throw new Error("Sequence cache cannot be a link");
  const files = new Map();
  const cases = new Set();
  const put = (relative, bytes, role) => {
    if (cases.has(relative.toLowerCase())) throw new Error(`Duplicate/case-colliding sequence path: ${relative}`);
    cases.add(relative.toLowerCase());
    files.set(relative, { bytes, role });
  };
  const sources = [];
  for (const source of entry.files) {
    const bytes = await readOwned(root, `upstream/${engine}/${source.path}`, source);
    if (source.path === "LICENSE") put("LICENSE", bytes, "license");
    else if (source.path.endsWith(".py")) {
      const transformed = Buffer.from(isolateImports(bytes.toString("utf8"), source.path));
      put(`vendor/${source.path}`, transformed, "source");
      sources.push({
        path: source.path,
        gitBlobSha1: source.gitBlobSha1,
        originalSha256: source.sha256,
        bundledSha256: hash(transformed)
      });
    } else throw new Error(`Undeclared inference file type: ${source.path}`);
  }
  if (!files.has("LICENSE")) throw new Error("Sequence engine license is required");
  const packages = new Set(["vendor"]);
  for (const relative of files.keys())
    if (relative.endsWith(".py")) {
      let directory = path.posix.dirname(relative);
      while (directory.startsWith("vendor")) {
        packages.add(directory);
        directory = path.posix.dirname(directory);
      }
    }
  for (const directory of packages) {
    const init = `${directory}/__init__.py`;
    if (!files.has(init)) put(init, Buffer.from("# Isolated inference package.\n"), "source");
  }
  for (const weight of entry.weights) {
    const bytes = await readOwned(root, `weights/${engine}/${weight.name}`, weight);
    put(`weights/${weight.name}`, bytes, "weight");
  }
  const provenance = {
    repository: `https://github.com/${entry.repository}`,
    revision: entry.revision,
    license: entry.license,
    modifications: [
      "UTF-8/LF and final-newline normalization",
      "Absolute model/core/RAFT imports converted to package-relative imports",
      "Empty package initializers added where needed"
    ],
    sources,
    weights: entry.weights
  };
  put("PROVENANCE.json", Buffer.from(JSON.stringify(provenance, null, 2) + "\n"), "provenance");
  const descriptor = {
    assetSchemaVersion: 1,
    engine,
    namespace: `toolbox_video_ai_vendor.${engine}`,
    repository: provenance.repository,
    revision: entry.revision,
    license: entry.license,
    // Source staging stays closed by default. Explicit opt-in affects this new bundle only.
    adapterReady,
    files: [...files].map(([relative, file]) => ({
      path: relative,
      role: file.role,
      bytes: file.bytes.length,
      sha256: hash(file.bytes)
    }))
  };
  await fs.mkdir(destination, { recursive: false }); // Never overwrite any existing generation/stage.
  for (const [relative, file] of files) {
    const output = path.join(destination, ...relative.split("/"));
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, file.bytes, { flag: "wx" });
  }
  await fs.writeFile(path.join(destination, "sequence-bundle.json"), JSON.stringify(descriptor, null, 2) + "\n", {
    flag: "wx"
  });
  return descriptor;
}
