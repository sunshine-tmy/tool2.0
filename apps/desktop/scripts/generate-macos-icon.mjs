import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const source = path.join(desktopRoot, "assets", "ecommerce-toolbox-icon-master-1024.png");

export async function generateMacOSIcon(outputDirectory) {
  if (process.platform !== "darwin") throw new Error("macOS .icns generation requires macOS tools (sips and iconutil)");
  const iconset = path.join(outputDirectory, "ecommerce-toolbox.iconset");
  const output = path.join(outputDirectory, "ecommerce-toolbox.icns");
  await fs.rm(iconset, { recursive: true, force: true });
  await fs.mkdir(iconset, { recursive: true });
  await fs.access(source);

  for (const size of [16, 32, 128, 256, 512]) {
    await run("sips", [
      "-z",
      String(size),
      String(size),
      source,
      "--out",
      path.join(iconset, `icon_${size}x${size}.png`)
    ]);
    await run("sips", [
      "-z",
      String(size * 2),
      String(size * 2),
      source,
      "--out",
      path.join(iconset, `icon_${size}x${size}@2x.png`)
    ]);
  }
  await run("iconutil", ["-c", "icns", iconset, "-o", output]);
  return output;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const output = await generateMacOSIcon(path.resolve(process.argv[2] ?? path.join(desktopRoot, ".stage")));
    console.log(`macOS application icon generated: ${output}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "macOS icon generation failed");
    process.exitCode = 1;
  }
}
