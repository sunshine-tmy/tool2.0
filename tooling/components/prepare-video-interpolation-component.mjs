import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import SOURCE from "./video-interpolation-sources.json" with { type: "json" };
import { ensureStrictCodeSignature } from "./macos-code-signing.mjs";

/** 从已核验的原生发行目录准备候选资产，不安装、不打包、不签名、不联网。 */
export async function prepareVideoInterpolationComponent({ sourceDirectory, stagingDirectory }) {
  const windows = process.platform === "win32" && process.arch === "x64";
  const mac = process.platform === "darwin" && process.arch === "arm64";
  if (!windows && !mac) throw new Error("补帧资产准备只支持 Windows x64 和 Apple Silicon macOS");
  const nativeSource = windows ? SOURCE.windows : SOURCE.macos;
  const source = await fs.realpath(sourceDirectory),
    stage = path.resolve(stagingDirectory);
  if (stage === source || source.startsWith(stage + path.sep) || stage.startsWith(source + path.sep))
    throw new Error("源目录和暂存目录不能互相包含");
  if (await fs.stat(stage).catch(() => undefined)) throw new Error("暂存目录已存在，拒绝覆盖");
  const binary = process.platform === "win32" ? "rife-ncnn-vulkan.exe" : "rife-ncnn-vulkan";
  const files = [binary, "rife-v4.6/flownet.param", "rife-v4.6/flownet.bin"];
  files.push(...Object.keys(nativeSource.files).filter((name) => /\.(?:dll|dylib)$/i.test(name)));
  const licenses = ["LICENSE"];
  for (const file of [...files, ...licenses]) {
    const real = await fs.realpath(path.join(source, file));
    if (!real.startsWith(source + path.sep) || !(await fs.stat(real)).isFile()) throw new Error("补帧资产路径无效");
  }
  for (const [file, checksum] of Object.entries(nativeSource.files)) {
    const actual = createHash("sha256")
      .update(await fs.readFile(path.join(source, file)))
      .digest("hex");
    if (actual !== checksum) throw new Error(`上游资产摘要不匹配：${file}`);
  }
  await fs.mkdir(stage, { recursive: true });
  for (const file of files) {
    const target = path.join(stage, file.startsWith("rife-v4.6/") ? `models/${file}` : `bin/${file}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(source, file), target);
    if (file === binary && process.platform !== "win32") await fs.chmod(target, 0o755);
  }
  if (mac) ensureStrictCodeSignature(path.join(stage, "bin", binary));
  for (const file of licenses) {
    await fs.mkdir(path.join(stage, "licenses"), { recursive: true });
    await fs.copyFile(path.join(source, file), path.join(stage, "licenses", file));
  }
  await fs.writeFile(
    path.join(stage, "upstream.json"),
    JSON.stringify({ project: "nihui/rife-ncnn-vulkan", release: "20221029", model: "rife-v4.6" }, null, 2)
  );
  return stage;
}
const publicEntry = new URL("../../scripts/prepare-video-interpolation-component.mjs", import.meta.url).href;
if (process.argv[1] && [publicEntry, import.meta.url].includes(pathToFileURL(path.resolve(process.argv[1])).href)) {
  const { values } = parseArgs({ options: { source: { type: "string" }, stage: { type: "string" } } });
  if (!values.source || !values.stage) throw new Error("用法：--source <已核验的发行目录> --stage <新暂存目录>");
  console.log(
    await prepareVideoInterpolationComponent({ sourceDirectory: values.source, stagingDirectory: values.stage })
  );
}
