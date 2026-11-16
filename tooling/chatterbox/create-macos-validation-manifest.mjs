import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, copyFile, lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  CHATTERBOX_MODEL_ASSETS,
  CHATTERBOX_MODEL_REVISION,
  CHATTERBOX_SOURCE_COMMIT
} from "../components/prepare-chatterbox-component.mjs";

const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const SAMPLE_PATHS = ["samples/reference-ms.wav", "samples/reference-en.wav", "samples/reference-pt-BR.wav"];
const SOURCE_ARCHIVE = {
  name: `chatterbox-source-${CHATTERBOX_SOURCE_COMMIT.slice(0, 7)}.zip`,
  url: `https://codeload.github.com/resemble-ai/chatterbox/zip/${CHATTERBOX_SOURCE_COMMIT}`,
  commit: CHATTERBOX_SOURCE_COMMIT
};
const HELP = `Usage:
  node tooling/chatterbox/create-macos-validation-manifest.mjs --assets-dir <absolute-directory> --environment-manifest <absolute-file> [--lock <absolute-file>] [--model-acquisition-base-url <https-url>]

Verify pinned Chatterbox models and synthetic voice references, copy the isolated environment lock and manifest, then write manifest.json and source-provenance.json. Existing output files are never overwritten.`;

export function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const { values } = parseArgs({
    args: argv,
    options: {
      "assets-dir": { type: "string" },
      "environment-manifest": { type: "string" },
      lock: { type: "string" },
      "model-acquisition-base-url": { type: "string" },
      help: { type: "boolean", short: "h" }
    },
    strict: true,
    allowPositionals: false
  });
  if (!values["assets-dir"] || !values["environment-manifest"])
    throw new Error("--assets-dir and --environment-manifest are required; use --help");
  for (const [name, value] of Object.entries(values)) {
    if (name === "help" || value === undefined) continue;
    if (name === "model-acquisition-base-url") {
      if (!/^https:\/\//i.test(value)) throw new Error("--model-acquisition-base-url must be an HTTPS URL");
    } else if (!path.isAbsolute(value)) {
      throw new Error(`--${name} must be an absolute path`);
    }
  }
  return {
    help: false,
    assetsDirectory: values["assets-dir"],
    environmentManifest: values["environment-manifest"],
    lockPath: values.lock ?? path.join(REPOSITORY_ROOT, ".package", "macos-locks", "chatterbox.lock.txt"),
    modelAcquisitionBaseUrl: values["model-acquisition-base-url"] ?? null
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
  return { path: candidate, info };
}

export async function createManifest({
  assetsDirectory,
  environmentManifest,
  lockPath,
  modelAcquisitionBaseUrl,
  modelAssets = CHATTERBOX_MODEL_ASSETS,
  samplePaths = SAMPLE_PATHS,
  modelRevision = CHATTERBOX_MODEL_REVISION,
  sourceCommit = CHATTERBOX_SOURCE_COMMIT,
  sourceArchive = {
    ...SOURCE_ARCHIVE,
    commit: sourceCommit,
    url: `https://codeload.github.com/resemble-ai/chatterbox/zip/${sourceCommit}`
  }
}) {
  const root = path.resolve(assetsDirectory);
  const manifestPath = path.join(root, "manifest.json");
  const provenancePath = path.join(root, "source-provenance.json");
  for (const target of [manifestPath, provenancePath]) {
    try {
      await access(target);
      throw new Error(`Refusing to overwrite existing file: ${target}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const modelBaseUrl = (
    modelAcquisitionBaseUrl ?? `https://huggingface.co/ResembleAI/chatterbox/resolve/${modelRevision}`
  ).replace(/\/$/, "");
  if (!/^https:\/\//i.test(modelBaseUrl)) throw new Error("Model acquisition base URL must use HTTPS");
  const resources = [];
  const modelRecords = [];
  for (const asset of modelAssets) {
    const { path: filePath, info } = await regularFile(root, asset.relativePath);
    if (info.size !== asset.bytes) throw new Error(`Pinned model size mismatch: ${asset.name}`);
    const actual = await sha256File(filePath);
    if (actual !== asset.sha256) throw new Error(`Pinned model SHA-256 mismatch: ${asset.name}`);
    const upstreamUrl = `https://huggingface.co/ResembleAI/chatterbox/resolve/${modelRevision}/${asset.name}`;
    const downloadedFrom = `${modelBaseUrl}/${asset.name}`;
    modelRecords.push({
      name: asset.name,
      bytes: info.size,
      sha256: actual,
      path: asset.relativePath,
      pinnedUrl: upstreamUrl,
      downloadedFrom
    });
    resources.push({ id: `chatterbox-model:${asset.name}`, path: asset.relativePath, sha256: actual });
  }

  const sampleRecords = [];
  for (const relativePath of samplePaths) {
    const { path: filePath, info } = await regularFile(root, relativePath);
    const sha256 = await sha256File(filePath);
    sampleRecords.push({ path: relativePath, bytes: info.size, sha256 });
    resources.push({ id: `sample:${path.posix.basename(relativePath)}`, path: relativePath, sha256 });
  }

  const archivePath = path.join(root, ".incoming", sourceArchive.name);
  const archiveInfo = await lstat(archivePath).catch(() => null);
  if (!archiveInfo?.isFile() || archiveInfo.isSymbolicLink())
    throw new Error(`Missing Chatterbox source archive: ${sourceArchive.name}`);
  const sourceArchiveRecord = {
    ...sourceArchive,
    bytes: archiveInfo.size,
    sha256: await sha256File(archivePath)
  };

  const evidenceDirectory = path.join(root, "evidence");
  await mkdir(evidenceDirectory, { recursive: false });
  const environmentDestination = path.join(evidenceDirectory, "chatterbox-environment-manifest.json");
  const lockDestination = path.join(evidenceDirectory, "chatterbox.lock.txt");
  await copyFile(environmentManifest, environmentDestination, 1);
  await copyFile(lockPath, lockDestination, 1);
  resources.push(
    {
      id: "environment:chatterbox-manifest",
      path: "evidence/chatterbox-environment-manifest.json",
      sha256: await sha256File(environmentDestination)
    },
    {
      id: "environment:chatterbox-lock",
      path: "evidence/chatterbox.lock.txt",
      sha256: await sha256File(lockDestination)
    }
  );

  const provenance = {
    schemaVersion: 1,
    source: {
      repository: "https://github.com/resemble-ai/chatterbox",
      commit: sourceCommit,
      archive: sourceArchiveRecord
    },
    modelRevision,
    modelAssets: modelRecords,
    samples: {
      generator: "macOS say with afconvert; PCM signed 16-bit, 24 kHz, mono",
      voices: {
        "reference-ms.wav": "Amira (ms_MY)",
        "reference-en.wav": "Samantha (en_US)",
        "reference-pt-BR.wav": "Luciana (pt_BR)"
      },
      files: sampleRecords
    },
    environment: {
      manifest: {
        path: "evidence/chatterbox-environment-manifest.json",
        sha256: await sha256File(environmentDestination)
      },
      lock: { path: "evidence/chatterbox.lock.txt", sha256: await sha256File(lockDestination) }
    }
  };
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, { flag: "wx" });
  resources.push({ id: "source-provenance", path: "source-provenance.json", sha256: await sha256File(provenancePath) });
  resources.push({
    id: "chatterbox-source-archive",
    path: `.incoming/${sourceArchive.name}`,
    sha256: sourceArchiveRecord.sha256
  });

  await writeFile(manifestPath, `${JSON.stringify({ schemaVersion: 1, resources }, null, 2)}\n`, { flag: "wx" });
  return { resources: resources.length, manifestPath, provenancePath };
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
