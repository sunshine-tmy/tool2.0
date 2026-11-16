import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { createPropainterValidationManifest } from "./create-macos-propainter-validation-manifest.mjs";
import { prepareSequenceValidation } from "./prepare-sequence-validation.mjs";
import { stageSequenceBundle } from "./sequence-bundle.mjs";

const exec = promisify(execFile);
const usage = `Usage:
  node tooling/video-ai/prepare-macos-propainter-validation-assets.mjs --assets-dir <new-directory> \\
    --environment-lock <video-ai-LOCK.txt> --environment-manifest <MANIFEST.json> \\
    --ffmpeg <absolute-path> --ffprobe <absolute-path> [--proxy <https-proxy-url>]

Downloads only the pinned ProPainter inference source and weights. No dependencies are installed; use is limited to the recorded non-commercial license terms.`;

export async function prepareMacosPropainterValidationAssets(options) {
  const root = path.resolve(options.assetsDirectory);
  const fullLock = JSON.parse(await fs.readFile(new URL("./sequence-sources.json", import.meta.url), "utf8"));
  if (fullLock.schemaVersion !== 1 || !fullLock.engines?.propainter)
    throw new Error("Pinned ProPainter source lock is missing");
  const manifest = { schemaVersion: 1, engines: { propainter: fullLock.engines.propainter } };
  const download = async (url, destination) => {
    const args = [
      "--fail",
      "--location",
      "--retry",
      "2",
      "--connect-timeout",
      "15",
      "--max-time",
      "300",
      "--silent",
      "--show-error",
      "--proto",
      "=https",
      "--proto-redir",
      "=https",
      "--output",
      destination
    ];
    if (options.proxy) args.unshift("--proxy", options.proxy);
    args.push(url);
    await exec(process.platform === "win32" ? "curl.exe" : "curl", args, { windowsHide: true, timeout: 920_000 });
  };
  const verified = await prepareSequenceValidation({ root, manifest, download });
  const descriptor = await stageSequenceBundle({
    cacheRoot: root,
    destination: path.join(root, "engine-root"),
    engine: "propainter",
    manifest,
    adapterReady: false
  });
  const evidence = await createPropainterValidationManifest({
    assetsDirectory: root,
    environmentLock: options.environmentLock,
    environmentManifest: options.environmentManifest,
    ffmpeg: options.ffmpeg,
    ffprobe: options.ffprobe
  });
  return {
    verified: verified.length,
    revision: descriptor.revision,
    license: descriptor.license,
    adapterReady: descriptor.adapterReady,
    ...evidence
  };
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
        proxy: { type: "string" },
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
      if (values.proxy && !/^https?:\/\//i.test(values.proxy)) throw new Error("--proxy must be an HTTP(S) proxy URL");
      const result = await prepareMacosPropainterValidationAssets({
        assetsDirectory: values["assets-dir"],
        environmentLock: values["environment-lock"],
        environmentManifest: values["environment-manifest"],
        ffmpeg: values.ffmpeg,
        ffprobe: values.ffprobe,
        proxy: values.proxy
      });
      console.log(JSON.stringify(result));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
