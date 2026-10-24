/** Explicit runtime closure, shared by staging and isolated distribution tests. No package or model preparation. */
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function copyRuntimeScripts(repositoryRoot, resourceRoot) {
  const manifest = JSON.parse(await readFile(new URL("./runtime-scripts.json", import.meta.url), "utf8"));
  for (const relative of Object.values(manifest.groups).flat()) {
    const destination = path.join(resourceRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(repositoryRoot, relative), destination);
  }
}
