import { readFileSync } from "node:fs";

const sourceLock = JSON.parse(readFileSync(new URL("./sequence-sources.json", import.meta.url), "utf8"));
const entry = sourceLock.engines.propainter;

export const PROPAINTER_MACOS_VALIDATION_ASSETS = Object.freeze([
  ...entry.files.map((file) => ({
    id: `propainter-source:${file.path}`,
    path: `upstream/propainter/${file.path}`,
    sha256: file.sha256
  })),
  ...entry.weights.map((weight) => ({
    id: `propainter-weight:${weight.name}`,
    path: `weights/propainter/${weight.name}`,
    sha256: weight.sha256
  })),
  {
    id: "video-ffmpeg",
    path: "tools/ffmpeg",
    sha256: "f47a8ffd2d3110d1b3c0a4cfa1bf72973f0d7ce8432a2af56bc61e8c9407aa72"
  },
  {
    id: "video-ffprobe",
    path: "tools/ffprobe",
    sha256: "89f24747ebef1def4820fefbe68cd3fdf289d9f3f5ea08644e2076dca6427867"
  },
  {
    id: "video-ai-environment-lock",
    path: "evidence/video-ai-LOCK.txt",
    sha256: "0e7fb967e8a5daae9109497b80dc8408fa5aead0cacaffed996f6667a6e93194"
  },
  {
    id: "video-ai-environment-manifest",
    path: "evidence/video-ai-MANIFEST.json",
    sha256: "67ff777dd3cbda772cb7959a8e925f89cd711894e70ea0790d16ba0f2d39d5cc"
  }
]);

export const PROPAINTER_VALIDATION_SOURCE = Object.freeze({
  repository: `https://github.com/${entry.repository}`,
  revision: entry.revision,
  license: entry.license,
  constraints: "Non-commercial validation only under the recorded NTU S-Lab License 1.0 terms."
});
