/** Fixed local resource discovery and signed offline import for the source launcher only. */
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import type { ComponentManager, ComponentCatalog } from "../modules/components/component-manager";
import { sourceComponentIds } from "./source-bootstrap";

type Manager = Pick<ComponentManager, "list" | "startOfflineImport">;

export async function createSourceOfflineInstaller(
  manager: Manager,
  catalog: ComponentCatalog,
  resourceRoot: string,
  report: (message: string) => void,
  withCuda = false
) {
  const ids: readonly string[] = withCuda ? [...sourceComponentIds, "chatterbox-cuda"] : sourceComponentIds;
  const initial = await manager.list();
  if (initial.some((item) => item.activeJobId)) throw new Error("能力安装作业尚未完成，拒绝并发初始化");
  const selected = new Map<string, Array<{ filename: string; file: string }>>();
  const problems: string[] = [];
  const realRoot = await fs.realpath(resourceRoot).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  for (const id of ids) {
    const manifest = catalog.manifests.find((item) => item.id === id);
    if (!manifest) throw new Error(`当前平台缺少签名能力：${id}`);
    const status = initial.find((item) => item.id === id);
    if (status?.installed && status.installedVersion === manifest.version && status.health === "healthy") continue;
    const files: Array<{ filename: string; file: string }> = [];
    for (const archive of [manifest.archive, ...(manifest.additionalArchives ?? [])]) {
      const filename = decodeURIComponent(path.posix.basename(new URL(archive.url).pathname));
      if (path.basename(filename) !== filename || !filename.endsWith(".tar.gz"))
        throw new Error("离线能力包文件名无效");
      const candidates = [path.join(resourceRoot, filename), path.join(resourceRoot, id, manifest.version, filename)];
      let found: string | undefined;
      let invalid = false;
      for (const candidate of candidates) {
        const stat = await fs.lstat(candidate).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
        if (!stat) continue;
        const realFile = await fs.realpath(candidate);
        const relative = realRoot ? path.relative(realRoot, realFile) : "..";
        if (
          !realRoot ||
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative) ||
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          stat.size !== archive.bytes
        ) {
          invalid = true;
          continue;
        }
        found = candidate;
        break;
      }
      if (found) files.push({ filename, file: found });
      else problems.push(`${invalid ? "文件无效/大小不符" : "缺少"}：${filename}\n  下载：${archive.url}`);
    }
    selected.set(id, files);
  }
  if (problems.length)
    throw new Error(
      `请先准备本地能力包（不会自动下载大文件）：\n${problems.join("\n")}\n放置位置：${resourceRoot}\n保持原名、不解压；详见 docs/source-resources.md。已安装能力及业务数据不变。`
    );
  return async (id: string) => {
    const files = selected.get(id);
    if (!files?.length) throw new Error("当前能力没有已检查的本地归档，拒绝联网安装");
    async function* uploads() {
      for (const archive of files!)
        yield { fieldName: "archives", filename: archive.filename, stream: createReadStream(archive.file) };
    }
    let last = 0;
    return manager.startOfflineImport(id, uploads(), (done, total) => {
      if (Date.now() - last >= 1000 || done === total) {
        report(`${id}：读取本地能力包 ${done}/${total} 字节`);
        last = Date.now();
      }
    });
  };
}
