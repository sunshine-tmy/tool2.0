import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { createSttnValidationManifest } from "./create-macos-sttn-validation-manifest.mjs";
import { prepareSequenceValidation } from "./prepare-sequence-validation.mjs";
import { stageSequenceBundle } from "./sequence-bundle.mjs";

const usage = `Usage:
  node tooling/video-ai/prepare-macos-sttn-validation-assets.mjs --assets-dir <new-directory> \\
    --environment-lock <video-ai-LOCK.txt> --environment-manifest <MANIFEST.json> \\
    --ffmpeg <absolute-path> --ffprobe <absolute-path>

Downloads only the pinned STTN source and weight for isolated validation. It does not install packages or change any capability.`;

export async function prepareMacosSttnValidationAssets(options) {
  const root = path.resolve(options.assetsDirectory);
  const lock = JSON.parse(await fs.readFile(new URL("./sequence-sources.json", import.meta.url), "utf8"));
  if (lock.schemaVersion !== 1 || !lock.engines?.sttn) throw new Error("Pinned STTN source lock is missing");
  const manifest = { schemaVersion: 1, engines: { sttn: lock.engines.sttn } };
  const verified = await prepareSequenceValidation({ root, manifest });
  const descriptor = await stageSequenceBundle({
    cacheRoot: root,
    destination: path.join(root, "engine-root"),
    engine: "sttn",
    manifest,
    adapterReady: false
  });
  const evidence = await createSttnValidationManifest({
    assetsDirectory: root,
    environmentLock: options.environmentLock,
    environmentManifest: options.environmentManifest,
    ffmpeg: options.ffmpeg,
    ffprobe: options.ffprobe
  });
  return { verified, revision: descriptor.revision, adapterReady: descriptor.adapterReady, ...evidence };
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
      const result = await prepareMacosSttnValidationAssets({
        assetsDirectory: values["assets-dir"],
        environmentLock: values["environment-lock"],
        environmentManifest: values["environment-manifest"],
        ffmpeg: values.ffmpeg,
        ffprobe: values.ffprobe
      });
      console.log(JSON.stringify(result));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
