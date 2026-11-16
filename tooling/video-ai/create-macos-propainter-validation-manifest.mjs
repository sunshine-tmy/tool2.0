import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  PROPAINTER_MACOS_VALIDATION_ASSETS,
  PROPAINTER_VALIDATION_SOURCE
} from "./macos-propainter-validation-assets.mjs";

const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const usage = `Usage:
  node tooling/video-ai/create-macos-propainter-validation-manifest.mjs --assets-dir <directory> \\
    --environment-lock <video-ai-LOCK.txt> --environment-manifest <MANIFEST.json> \\
    --ffmpeg <absolute-path> --ffprobe <absolute-path>

Creates a local validation manifest after checking every pinned source, weight and bundle digest.`;

export async function createPropainterValidationManifest({
  assetsDirectory,
  environmentLock,
  environmentManifest,
  ffmpeg,
  ffprobe
}) {
  const root = path.resolve(assetsDirectory);
  for (const [source, relative] of [
    [ffmpeg, "tools/ffmpeg"],
    [ffprobe, "tools/ffprobe"],
    [environmentLock, "evidence/video-ai-LOCK.txt"],
    [environmentManifest, "evidence/video-ai-MANIFEST.json"]
  ]) {
    if (!source || !path.isAbsolute(source)) throw new Error(`Expected an absolute source path for ${relative}`);
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
  }
  const resources = [];
  for (const asset of PROPAINTER_MACOS_VALIDATION_ASSETS) {
    const target = path.join(root, ...asset.path.split("/"));
    const info = await fs.lstat(target);
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error(`Missing or linked pinned validation file: ${asset.path}`);
    const sha256 = digest(await fs.readFile(target));
    if (sha256 !== asset.sha256) throw new Error(`Pinned SHA-256 mismatch: ${asset.path}`);
    resources.push({ ...asset });
  }
  const descriptorPath = "engine-root/sequence-bundle.json";
  const descriptor = JSON.parse(await fs.readFile(path.join(root, descriptorPath), "utf8"));
  if (
    descriptor.assetSchemaVersion !== 1 ||
    descriptor.engine !== "propainter" ||
    descriptor.revision !== PROPAINTER_VALIDATION_SOURCE.revision ||
    descriptor.adapterReady !== false
  )
    throw new Error("ProPainter validation bundle must be pinned and remain adapterReady:false");
  for (const file of descriptor.files) {
    const relative = `engine-root/${file.path}`;
    const target = path.join(root, ...relative.split("/"));
    const info = await fs.lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Missing or linked bundle asset: ${relative}`);
    const sha256 = digest(await fs.readFile(target));
    if (sha256 !== file.sha256) throw new Error(`Bundle SHA-256 mismatch: ${relative}`);
    resources.push({ id: `propainter-bundle:${file.path}`, path: relative, sha256 });
  }
  const descriptorBytes = await fs.readFile(path.join(root, descriptorPath));
  resources.push({ id: "propainter-bundle-descriptor", path: descriptorPath, sha256: digest(descriptorBytes) });
  const provenance = {
    purpose: "M01-05 isolated macOS ProPainter inference validation; not a capability manifest",
    ...PROPAINTER_VALIDATION_SOURCE,
    weights: PROPAINTER_MACOS_VALIDATION_ASSETS.filter((asset) => asset.id.startsWith("propainter-weight:")),
    execution: "Validation only; the unsigned adapter is under tooling/video-ai and adapterReady remains false."
  };
  const provenanceBytes = Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`);
  await fs.writeFile(path.join(root, "source-provenance.json"), provenanceBytes, { flag: "wx" });
  resources.push({
    id: "propainter-source-provenance",
    path: "source-provenance.json",
    sha256: digest(provenanceBytes)
  });
  const manifestPath = path.join(root, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify({ schemaVersion: 1, resources }, null, 2)}\n`, { flag: "wx" });
  return { resourceCount: resources.length, manifestPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        "assets-dir": { type: "string" },
        "environment-lock": { type: "string" },
        "environment-manifest": { type: "string" },
        ffmpeg: { type: "string" },
        ffprobe: { type: "string" },
        help: { type: "boolean", short: "h" }
      },
      strict: true,
      allowPositionals: false
    });
    if (values.help) {
      process.stdout.write(`${usage}\n`);
    } else {
      for (const key of ["assets-dir", "environment-lock", "environment-manifest", "ffmpeg", "ffprobe"])
        if (!values[key] || !path.isAbsolute(values[key])) throw new Error(`--${key} must be an absolute path`);
      const result = await createPropainterValidationManifest({
        assetsDirectory: values["assets-dir"],
        environmentLock: values["environment-lock"],
        environmentManifest: values["environment-manifest"],
        ffmpeg: values.ffmpeg,
        ffprobe: values.ffprobe
      });
      console.log(`Verified ${result.resourceCount} ProPainter resources; adapterReady remains false`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
