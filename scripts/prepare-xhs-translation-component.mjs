/** 中文模块说明：从固定 OPUS-MT 模型和哈希锁准备离线小红书翻译能力。 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_REVISION = "cf109095479db38d6df799875e34039d4938aaa6";
const MODEL_FILES = [
  "config.json",
  "generation_config.json",
  "model.bin",
  "shared_vocabulary.json",
  "source.spm",
  "target.spm",
  "tokenizer_config.json",
  "vocab.json"
];

export async function prepareXhsTranslationComponent({ pythonExecutablePath, modelDirectory, stagingDirectory }) {
  const python = path.resolve(pythonExecutablePath);
  const modelSource = path.resolve(modelDirectory);
  const stage = path.resolve(stagingDirectory);
  const version = execFileSync(
    python,
    ["-I", "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 30_000,
      env: cleanPythonEnvironment()
    }
  );
  if (version.trim() !== "3.12") throw new Error("小红书翻译 wheelhouse 必须由 Python 3.12 准备");
  const manifest = await verifyModel(modelSource);
  if (await pathExists(stage)) throw new Error("小红书翻译暂存目录已存在，拒绝覆盖");
  const lockSource = path.join(REPOSITORY_ROOT, "scripts", "xhs-translation.lock.txt");
  await fs.access(lockSource);

  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const wheelhouse = path.join(stage, "wheelhouse");
    const scripts = path.join(stage, "scripts");
    const model = path.join(stage, "model");
    await Promise.all([fs.mkdir(wheelhouse), fs.mkdir(scripts), fs.mkdir(model)]);
    await Promise.all([
      fs.copyFile(
        path.join(REPOSITORY_ROOT, "scripts", "xhs-translation-worker.py"),
        path.join(scripts, "xhs-translation-worker.py")
      ),
      fs.copyFile(lockSource, path.join(stage, "requirements.lock")),
      ...MODEL_FILES.map((name) => fs.copyFile(path.join(modelSource, name), path.join(model, name))),
      fs.copyFile(path.join(modelSource, "manifest.json"), path.join(model, "manifest.json"))
    ]);

    execFileSync(
      python,
      [
        "-m",
        "pip",
        "--isolated",
        "--no-cache-dir",
        "--disable-pip-version-check",
        "download",
        "--only-binary=:all:",
        "--require-hashes",
        "--dest",
        wheelhouse,
        "-r",
        path.join(stage, "requirements.lock")
      ],
      { stdio: "inherit", windowsHide: true, timeout: 60 * 60 * 1000, env: cleanPythonEnvironment() }
    );
    const wheels = await fs.readdir(wheelhouse, { withFileTypes: true });
    if (!wheels.length || wheels.some((entry) => !entry.isFile() || !entry.name.endsWith(".whl"))) {
      throw new Error("小红书翻译 wheelhouse 必须只包含通过哈希锁校验的 wheel 文件");
    }
    return { stagingDirectory: stage, wheelCount: wheels.length, modelRevision: manifest.revision };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function verifyModel(modelRoot) {
  const manifest = JSON.parse(await fs.readFile(path.join(modelRoot, "manifest.json"), "utf8"));
  if (manifest.modelId !== "Helsinki-NLP/opus-mt-zh-en" || manifest.revision !== MODEL_REVISION) {
    throw new Error("小红书翻译模型 ID 或固定 revision 不匹配");
  }
  const declaredFiles = Object.keys(manifest.files ?? {}).sort();
  if (
    declaredFiles.length !== MODEL_FILES.length ||
    declaredFiles.some((name, index) => name !== [...MODEL_FILES].sort()[index])
  ) {
    throw new Error("小红书翻译模型文件清单与审核版本不匹配");
  }
  for (const name of MODEL_FILES) {
    const expected = manifest.files[name];
    const filePath = path.join(modelRoot, name);
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size !== expected.size) throw new Error("小红书翻译模型大小校验失败：" + name);
    const digest = crypto.createHash("sha256");
    for await (const chunk of createReadStream(filePath)) digest.update(chunk);
    if (digest.digest("hex") !== expected.sha256) throw new Error("小红书翻译模型摘要校验失败：" + name);
  }
  return manifest;
}

function cleanPythonEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE"]) delete environment[key];
  environment.PYTHONNOUSERSITE = "1";
  if (process.platform === "win32") environment.PIP_CONFIG_FILE = "NUL";
  return environment;
}

function pathExists(candidate) {
  return fs.lstat(candidate).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  );
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  if (values.size !== 3 || !values.has("python") || !values.has("model") || !values.has("stage")) {
    throw new Error(
      "用法：pnpm components:prepare-xhs-translation -- --python <Python 3.12 python.exe> --model <固定模型目录> --stage <新暂存目录>"
    );
  }
  return {
    pythonExecutablePath: values.get("python"),
    modelDirectory: values.get("model"),
    stagingDirectory: values.get("stage")
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareXhsTranslationComponent(parseArguments(process.argv.slice(2)));
    console.log("小红书翻译运行时暂存目录已准备：" + result.stagingDirectory);
    console.log(
      "固定模型 revision：" + result.modelRevision + "；wheelhouse：" + result.wheelCount + " 个哈希锁定 wheel"
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "小红书翻译能力准备失败");
    process.exitCode = 1;
  }
}
