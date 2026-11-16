import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STTN_MACOS_VALIDATION_ASSETS } from "./macos-sttn-validation-assets.mjs";

const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

export async function createSttnValidationManifest({
  assetsDirectory,
  environmentLock,
  environmentManifest,
  ffmpeg,
  ffprobe
}) {
  const root = path.resolve(assetsDirectory);
  const copies = [
    [ffmpeg, "tools/ffmpeg"],
    [ffprobe, "tools/ffprobe"],
    [environmentLock, "evidence/video-ai-LOCK.txt"],
    [environmentManifest, "evidence/video-ai-MANIFEST.json"]
  ];
  for (const [source, relative] of copies) {
    if (!source || !path.isAbsolute(source)) throw new Error(`Expected an absolute source path for ${relative}`);
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
  }
  const resources = [];
  for (const asset of STTN_MACOS_VALIDATION_ASSETS) {
    const target = path.join(root, ...asset.path.split("/"));
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`Missing or linked pinned validation file: ${asset.path}`);
    const bytes = await fs.readFile(target);
    const sha256 = digest(bytes);
    if (sha256 !== asset.sha256) throw new Error(`Pinned SHA-256 mismatch: ${asset.path}`);
    resources.push({ ...asset });
  }
  const bundle = JSON.parse(await fs.readFile(path.join(root, "engine-root/sequence-bundle.json"), "utf8"));
  if (
    bundle.assetSchemaVersion !== 1 ||
    bundle.engine !== "sttn" ||
    bundle.revision !== "f39f62c5bbbe3e3eba084c487353a2c651bfdcde" ||
    bundle.adapterReady !== false
  )
    throw new Error("STTN validation bundle must be pinned and remain adapterReady:false");
  for (const file of bundle.files) {
    const relative = `engine-root/${file.path}`;
    const target = path.join(root, ...relative.split("/"));
    const info = await fs.lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Missing or linked bundle asset: ${relative}`);
    const sha256 = digest(await fs.readFile(target));
    if (sha256 !== file.sha256) throw new Error(`Bundle SHA-256 mismatch: ${relative}`);
    resources.push({ id: `sttn-bundle:${file.path}`, path: relative, sha256 });
  }
  const descriptorPath = "engine-root/sequence-bundle.json";
  const descriptorBytes = await fs.readFile(path.join(root, descriptorPath));
  resources.push({ id: "sttn-bundle-descriptor", path: descriptorPath, sha256: digest(descriptorBytes) });
  const provenance = {
    purpose: "M01-04 isolated macOS STTN inference validation; not a capability manifest",
    repository: "https://github.com/researchmm/STTN",
    revision: "f39f62c5bbbe3e3eba084c487353a2c651bfdcde",
    license: "MIT",
    weights: STTN_MACOS_VALIDATION_ASSETS.filter((asset) => asset.id === "sttn-weight"),
    tools: STTN_MACOS_VALIDATION_ASSETS.filter((asset) => asset.id.startsWith("video-ff")),
    execution: "The unsigned adapter exists only under tooling/video-ai and adapterReady remains false."
  };
  const provenanceBytes = Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`);
  await fs.writeFile(path.join(root, "source-provenance.json"), provenanceBytes, { flag: "wx" });
  resources.push({
    id: "sttn-source-provenance",
    path: "source-provenance.json",
    sha256: digest(provenanceBytes)
  });
  const manifestPath = path.join(root, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify({ schemaVersion: 1, resources }, null, 2)}\n`, { flag: "wx" });
  return { resourceCount: resources.length, manifestPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, all) => {
      if (index % 2 === 0 && value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
      return pairs;
    }, [])
  );
  try {
    const result = await createSttnValidationManifest({
      assetsDirectory: args["assets-dir"],
      environmentLock: args["environment-lock"],
      environmentManifest: args["environment-manifest"],
      ffmpeg: args.ffmpeg,
      ffprobe: args.ffprobe
    });
    console.log(`Verified ${result.resourceCount} STTN validation resources; adapterReady remains false`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
