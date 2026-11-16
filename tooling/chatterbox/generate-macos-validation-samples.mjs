import { execFileSync } from "node:child_process";
import { lstat, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const SAMPLE_VOICES = [
  {
    name: "reference-ms.wav",
    voice: "Amira",
    language: "ms_MY",
    text: "Selamat pagi. Hari ini cuaca sangat baik. Saya sedang menguji suara sintetik."
  },
  {
    name: "reference-en.wav",
    voice: "Samantha",
    language: "en_US",
    text: "Good morning. Today the weather is clear and bright. This is a synthetic voice reference."
  },
  {
    name: "reference-pt-BR.wav",
    voice: "Luciana",
    language: "pt_BR",
    text: "Bom dia. Hoje o tempo está agradável. Esta é uma voz sintética de referência."
  }
];
const HELP = `Usage:
  node tooling/chatterbox/generate-macos-validation-samples.mjs --assets-dir <absolute-directory>

Use the installed macOS say voices and afconvert to create three PCM 16-bit, 24 kHz mono reference WAVs. Existing sample directories are never overwritten.`;

export function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const { values } = parseArgs({
    args: argv,
    options: { "assets-dir": { type: "string" }, help: { type: "boolean", short: "h" } },
    strict: true,
    allowPositionals: false
  });
  if (!values["assets-dir"]) throw new Error("--assets-dir is required; use --help");
  if (!path.isAbsolute(values["assets-dir"])) throw new Error("--assets-dir must be an absolute path");
  return { help: false, assetsDirectory: values["assets-dir"] };
}

export async function generateSamples({ assetsDirectory, runCommand = execFileSync, samples = SAMPLE_VOICES }) {
  const root = path.resolve(assetsDirectory);
  const rootInfo = await stat(root).catch(() => null);
  if (!rootInfo?.isDirectory()) throw new Error(`Assets directory does not exist: ${root}`);
  if (process.platform !== "darwin") throw new Error("Chatterbox voice samples require native macOS say and afconvert");

  const samplesDirectory = path.join(root, "samples");
  try {
    await lstat(samplesDirectory);
    throw new Error(`Refusing to overwrite existing sample directory: ${samplesDirectory}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
    if (error?.code !== "ENOENT") throw error;
  }

  const temporaryDirectory = path.join(root, ".incoming", "say-samples-work");
  try {
    await lstat(temporaryDirectory);
    throw new Error(`Refusing to overwrite existing temporary directory: ${temporaryDirectory}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(samplesDirectory, { recursive: false });
  await mkdir(temporaryDirectory, { recursive: false });

  try {
    for (const sample of samples) {
      const aiffPath = path.join(temporaryDirectory, sample.name.replace(/\.wav$/i, ".aiff"));
      const wavPath = path.join(samplesDirectory, sample.name);
      runCommand("say", ["-v", sample.voice, "-r", "150", "-o", aiffPath, sample.text], {
        encoding: "utf8",
        stdio: "pipe",
        windowsHide: true
      });
      runCommand("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", "-c", "1", aiffPath, wavPath], {
        encoding: "utf8",
        stdio: "pipe",
        windowsHide: true
      });
      const wavInfo = await lstat(wavPath).catch(() => null);
      if (!wavInfo?.isFile() || wavInfo.size <= 44)
        throw new Error(`macOS did not create a valid reference WAV: ${sample.name}`);
    }
    return { samples: samples.map(({ name, voice, language }) => ({ name, voice, language })), samplesDirectory };
  } catch (error) {
    await rm(samplesDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    const temporaryEntries = await readdir(temporaryDirectory).catch(() => []);
    if (temporaryEntries.length) await rm(temporaryDirectory, { recursive: true, force: true });
    else await rm(temporaryDirectory, { recursive: false, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) process.stdout.write(`${HELP}\n`);
    else process.stdout.write(`${JSON.stringify(await generateSamples(options), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
