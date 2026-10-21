/** Local startup preparation tests: small fixtures only, no downloads, Python or model loading. */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentJob, ComponentPackageStatus } from "@toolbox/shared";
import {
  canonicalManifest,
  type ComponentCatalog,
  type ComponentManager
} from "../modules/components/component-manager";
import { packagedComponentCatalog } from "../modules/components/catalog.generated";
import { createSourceOfflineInstaller } from "../runtime/source-offline-resources";
import { sourceComponentIds } from "../runtime/source-bootstrap";
import plan from "../../../scripts/source-resources.generated.json";

let scratch = "";
afterEach(async () => {
  if (scratch) await fs.rm(scratch, { recursive: true, force: true });
  scratch = "";
});
async function fixture(installed: string[] = []) {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-source-offline-"));
  const root = path.join(scratch, "中文 resources (1)");
  await fs.mkdir(root);
  const catalog = {
    manifests: sourceComponentIds.map((id) => ({
      id,
      version: "1",
      archive: { url: `https://example.com/${id}-1.tar.gz`, bytes: 3 }
    }))
  } as ComponentCatalog;
  const manager = {
    list: vi.fn(
      async () =>
        catalog.manifests.map((item) => ({
          id: item.id,
          installed: installed.includes(item.id),
          installedVersion: "1",
          version: "1",
          health: "healthy"
        })) as ComponentPackageStatus[]
    ),
    startOfflineImport: vi.fn(
      async (
        _id: string,
        uploads: Parameters<ComponentManager["startOfflineImport"]>[1],
        progress?: (done: number, total: number) => void
      ) => {
        const received: string[] = [];
        for await (const upload of uploads) {
          let data = "";
          for await (const chunk of upload.stream) data += chunk.toString();
          expect(upload.fieldName).toBe("archives");
          expect(data).toBe("abc");
          received.push(upload.filename);
        }
        progress?.(3 * received.length, 3 * received.length);
        return { id: "local-job", state: "running" } as ComponentJob;
      }
    )
  };
  async function populate(nested = false) {
    for (const manifest of catalog.manifests)
      for (const archive of [manifest.archive, ...(manifest.additionalArchives ?? [])]) {
        const filename = path.posix.basename(new URL(archive.url).pathname);
        const file = nested ? path.join(root, manifest.id, manifest.version, filename) : path.join(root, filename);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, "abc");
      }
  }
  return { root, catalog, manager, populate };
}

describe("source offline resources", () => {
  it("reports every missing archive before any capability install, including remaining multipart files", async () => {
    const { root, catalog, manager } = await fixture();
    catalog.manifests[0].additionalArchives = [
      { ...catalog.manifests[0].archive, url: "https://example.com/model-part-2.tar.gz" }
    ];
    await fs.writeFile(path.join(root, "python-312-1.tar.gz"), "abc");
    const error = await createSourceOfflineInstaller(manager, catalog, root, () => undefined).catch(
      (error) => error as Error
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("model-part-2.tar.gz");
    expect((error as Error).message).toContain("douyin-archive-1.tar.gz");
    expect((error as Error).message).toContain("不会自动下载大文件");
    expect(manager.startOfflineImport).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "imports checked flat/nested local archives (%s) without a network install",
    async (nested) => {
      const { root, catalog, manager, populate } = await fixture();
      await populate(nested);
      const messages: string[] = [];
      const install = await createSourceOfflineInstaller(manager, catalog, root, (message) => messages.push(message));
      expect(await install("python-312")).toMatchObject({ id: "local-job" });
      expect(manager.startOfflineImport).toHaveBeenCalledOnce();
      expect(messages.join("\n")).toContain("读取本地能力包 3/3");
      await expect(install("not-a-component")).rejects.toThrow("拒绝联网安装");
    }
  );

  it("reuses healthy installed capabilities without needing archived files, but not different versions", async () => {
    const { root, catalog, manager } = await fixture([...sourceComponentIds]);
    await fs.rmdir(root);
    await expect(createSourceOfflineInstaller(manager, catalog, root, () => undefined)).resolves.toBeTypeOf("function");
    catalog.manifests[0].version = "2";
    await expect(createSourceOfflineInstaller(manager, catalog, root, () => undefined)).rejects.toThrow(
      "python-312-1.tar.gz"
    );
  });

  it("does not fall back to online downloads for wrong-sized files or incomplete CUDA additions", async () => {
    const { root, catalog, manager, populate } = await fixture();
    await populate();
    await fs.writeFile(path.join(root, "image-ai-1.tar.gz"), "wrong-sized");
    await expect(createSourceOfflineInstaller(manager, catalog, root, () => undefined)).rejects.toThrow(
      "文件无效/大小不符"
    );
    await fs.writeFile(path.join(root, "image-ai-1.tar.gz"), "abc");
    catalog.manifests.push({
      ...catalog.manifests[0],
      id: "chatterbox-cuda",
      archive: { ...catalog.manifests[0].archive, url: "https://example.com/cuda.tar.gz" }
    });
    await expect(createSourceOfflineInstaller(manager, catalog, root, () => undefined)).resolves.toBeTypeOf("function");
    await expect(createSourceOfflineInstaller(manager, catalog, root, () => undefined, true)).rejects.toThrow(
      "cuda.tar.gz"
    );
    expect(manager.startOfflineImport).not.toHaveBeenCalled();
  });

  it("refuses nested directories that redirect file reads outside the chosen resource root", async () => {
    const { root, catalog, manager, populate } = await fixture();
    await populate();
    await fs.unlink(path.join(root, "python-312-1.tar.gz"));
    const outside = path.join(scratch, "outside");
    await fs.mkdir(path.join(outside, "1"), { recursive: true });
    await fs.writeFile(path.join(outside, "1/python-312-1.tar.gz"), "abc");
    await fs.symlink(outside, path.join(root, "python-312"), process.platform === "win32" ? "junction" : "dir");
    await expect(createSourceOfflineInstaller(manager, catalog, root, () => undefined)).rejects.toThrow(
      "文件无效/大小不符"
    );
  });

  it.each([false, true])(
    "requires and imports all four GPU archives without reinstalling healthy CPU packages (nested=%s)",
    async (nested) => {
      const { root, catalog, manager, populate } = await fixture([...sourceComponentIds]);
      const archives = ["cuda", "cuda-torch-part-0001", "cuda-torch-part-0002", "cuda-torchaudio"].map((name) => ({
        ...catalog.manifests[0].archive,
        url: `https://example.com/${name}.tar.gz`
      }));
      catalog.manifests.push({
        ...catalog.manifests[0],
        id: "chatterbox-cuda",
        archive: archives[0],
        additionalArchives: archives.slice(1)
      });
      const missing = await createSourceOfflineInstaller(manager, catalog, root, () => undefined, true).catch(
        (error) => error as Error
      );
      for (const archive of archives)
        expect((missing as Error).message).toContain(path.posix.basename(new URL(archive.url).pathname));
      expect(manager.startOfflineImport).not.toHaveBeenCalled();
      await populate(nested);
      const install = await createSourceOfflineInstaller(manager, catalog, root, () => undefined, true);
      await install("chatterbox-cuda");
      expect(manager.startOfflineImport).toHaveBeenCalledOnce();
      expect(manager.startOfflineImport.mock.calls[0][0]).toBe("chatterbox-cuda");
      await expect(install("chatterbox")).rejects.toThrow("拒绝联网安装");
    }
  );

  it("keeps the early PowerShell checklist in sync with the signed catalog and CPU order", () => {
    expect(plan.components.filter((item) => item.required).map((item) => item.id)).toEqual(sourceComponentIds);
    expect(plan.components).toHaveLength(packagedComponentCatalog.manifests.length);
    for (const item of plan.components) {
      const manifest = packagedComponentCatalog.manifests.find((manifest) => manifest.id === item.id)!;
      expect(item.version).toBe(manifest.version);
      expect(item.manifestSha256).toBe(crypto.createHash("sha256").update(canonicalManifest(manifest)).digest("hex"));
      expect(item.archives).toEqual(
        [manifest.archive, ...(manifest.additionalArchives ?? [])].map((asset) => ({
          filename: decodeURIComponent(path.posix.basename(new URL(asset.url).pathname)),
          bytes: asset.bytes,
          sha256: asset.sha256,
          url: asset.url
        }))
      );
    }
  });
});
