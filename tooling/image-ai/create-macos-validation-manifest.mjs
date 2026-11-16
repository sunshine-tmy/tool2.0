import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, copyFile, lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { IMAGE_AI_MODEL_ASSETS } from "../components/prepare-image-ai-component.mjs";

const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const PADDLE_ARCHIVES = [
  {
    name: "PP-OCRv5_mobile_det_infer.tar",
    model: "PP-OCRv5_mobile_det",
    url: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_infer.tar"
  },
  {
    name: "PP-OCRv5_mobile_rec_infer.tar",
    model: "PP-OCRv5_mobile_rec",
    url: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_infer.tar"
  }
];
const SAMPLE_PATHS = ["samples/product.png", "samples/ocr.png", "samples/repair-mask.png"];
const HELP = `Usage:
  node tooling/image-ai/create-macos-validation-manifest.mjs --assets-dir <absolute-directory> --environment-manifest <absolute-file> [--lock <absolute-file>] [--archive-dir <absolute-directory>] [--acquisition-source <model-name=https-url> ...]

Verify pinned model weights and generated samples, copy the image environment lock and manifest into the asset directory, then write manifest.json and source-provenance.json. Existing output files are never overwritten.`;

export function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const { values } = parseArgs({
    args: argv,
    options: {
      "assets-dir": { type: "string" },
      "environment-manifest": { type: "string" },
      lock: { type: "string" },
      "archive-dir": { type: "string" },
      "acquisition-source": { type: "string", multiple: true },
      help: { type: "boolean", short: "h" }
    },
    strict: true,
    allowPositionals: false
  });
  if (!values["assets-dir"] || !values["environment-manifest"])
    throw new Error("--assets-dir and --environment-manifest are required; use --help");
  for (const [name, value] of Object.entries(values)) {
    if (name === "help" || name === "acquisition-source" || value === undefined) continue;
    if (!path.isAbsolute(value)) throw new Error(`--${name} must be an absolute path`);
  }
  const acquisitionSources = {};
  for (const value of values["acquisition-source"] ?? []) {
    const separator = value.indexOf("=");
    const name = value.slice(0, separator);
    const url = value.slice(separator + 1);
    if (separator < 1 || !/^https:\/\//i.test(url))
      throw new Error("--acquisition-source must be <model-name=https-url>");
    if (Object.hasOwn(acquisitionSources, name)) throw new Error(`Duplicate acquisition source for model: ${name}`);
    acquisitionSources[name] = url;
  }
  return {
    help: false,
    assetsDirectory: values["assets-dir"],
    environmentManifest: values["environment-manifest"],
    lockPath: values.lock ?? path.join(REPOSITORY_ROOT, ".package", "macos-locks", "image-ai.lock.txt"),
    archiveDirectory: values["archive-dir"] ?? path.join(values["assets-dir"], ".incoming"),
    acquisitionSources
  };
}

async function sha256File(filePath) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

async function regularFile(root, relativePath) {
  const candidate = path.join(root, ...relativePath.split("/"));
  const info = await lstat(candidate).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()) throw new Error(`Missing regular asset file: ${relativePath}`);
  return candidate;
}

export async function createManifest({
  assetsDirectory,
  environmentManifest,
  lockPath,
  archiveDirectory,
  acquisitionSources = {},
  modelAssets = IMAGE_AI_MODEL_ASSETS,
  paddleArchives = PADDLE_ARCHIVES,
  samplePaths = SAMPLE_PATHS
}) {
  const root = path.resolve(assetsDirectory);
  const output = path.join(root, "manifest.json");
  const provenancePath = path.join(root, "source-provenance.json");
  for (const target of [output, provenancePath]) {
    try {
      await access(target);
      throw new Error(`Refusing to overwrite existing file: ${target}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const resources = [];
  for (const asset of modelAssets) {
    const filePath = await regularFile(root, asset.relativePath);
    const actual = await sha256File(filePath);
    if (actual !== asset.sha256) throw new Error(`Pinned model SHA-256 mismatch: ${asset.name}`);
    resources.push({ id: `image-model:${asset.name}`, path: asset.relativePath, sha256: actual });
  }

  for (const relativePath of samplePaths) {
    const filePath = await regularFile(root, relativePath);
    resources.push({
      id: `sample:${path.posix.basename(relativePath)}`,
      path: relativePath,
      sha256: await sha256File(filePath)
    });
  }

  const evidenceDirectory = path.join(root, "evidence");
  await mkdir(evidenceDirectory, { recursive: false });
  const environmentDestination = path.join(evidenceDirectory, "image-ai-environment-manifest.json");
  const lockDestination = path.join(evidenceDirectory, "image-ai.lock.txt");
  await copyFile(environmentManifest, environmentDestination, 1);
  await copyFile(lockPath, lockDestination, 1);
  resources.push(
    {
      id: "environment:image-ai-manifest",
      path: "evidence/image-ai-environment-manifest.json",
      sha256: await sha256File(environmentDestination)
    },
    { id: "environment:image-ai-lock", path: "evidence/image-ai.lock.txt", sha256: await sha256File(lockDestination) }
  );

  const archiveRecords = [];
  for (const archive of paddleArchives) {
    const archivePath = path.join(archiveDirectory, archive.name);
    const info = await lstat(archivePath).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink()) throw new Error(`Missing PaddleOCR source archive: ${archive.name}`);
    archiveRecords.push({ ...archive, bytes: info.size, sha256: await sha256File(archivePath) });
  }

  const knownModelNames = new Set(modelAssets.map(({ name }) => name));
  for (const name of Object.keys(acquisitionSources)) {
    if (!knownModelNames.has(name)) throw new Error(`Unknown model acquisition source: ${name}`);
  }
  const provenance = {
    schemaVersion: 1,
    modelAssets: modelAssets.map(({ name, url, sha256, relativePath }) => ({
      name,
      pinnedUrl: url,
      downloadedFrom: acquisitionSources[name] ?? url,
      sha256,
      relativePath
    })),
    paddleOcrArchives: archiveRecords
  };
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, { flag: "wx" });
  resources.push({ id: "source-provenance", path: "source-provenance.json", sha256: await sha256File(provenancePath) });

  const manifest = { schemaVersion: 1, resources };
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return { resources: resources.length, manifestPath: output, provenancePath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) process.stdout.write(`${HELP}\n`);
    else process.stdout.write(`${JSON.stringify(await createManifest(options), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
