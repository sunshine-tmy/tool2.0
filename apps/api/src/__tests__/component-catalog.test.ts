/** 中文模块说明：嵌入应用的能力目录必须保留每个 manifest 的签名有效性。 */
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { packagedComponentCatalog as windowsCatalog } from "../modules/components/catalog.generated";
import { packagedComponentCatalog as macCatalog } from "../modules/components/catalog.darwin-arm64.generated";
import { canonicalManifest, type ComponentCatalog } from "../modules/components/component-manager";

const catalogs: Array<[string, ComponentCatalog]> = [
  ["Windows x64", windowsCatalog],
  ["macOS arm64", macCatalog]
];

describe("embedded component catalog signatures", () => {
  it("uses only Python 3.12 for new Windows installations", () => {
    expect(
      windowsCatalog.manifests.filter((manifest) => manifest.id.startsWith("python-")).map((manifest) => manifest.id)
    ).toEqual(["python-312"]);
    for (const manifest of windowsCatalog.manifests) {
      expect(manifest.dependencyIds).not.toContain("python-311");
      if (!manifest.pythonEnvironment) continue;
      expect(manifest.pythonEnvironment.pythonComponentId).toBe("python-312");
      expect(manifest.pythonEnvironment.expectedPythonVersion).toBe("3.12");
      expect(manifest.dependencyIds).toContain("python-312");
    }
    for (const id of ["edge-tts", "image-ai", "chatterbox", "chatterbox-cuda"]) {
      const manifest = windowsCatalog.manifests.find((item) => item.id === id);
      expect(manifest?.version, id).toContain("py312");
      expect(manifest?.pythonEnvironment?.expectedPythonVersion, id).toBe("3.12");
    }
  });

  it.each(catalogs)("keeps the %s dependency graph closed after capability removal", (_platform, catalog) => {
    const ids = new Set(catalog.manifests.map((manifest) => manifest.id));
    for (const manifest of catalog.manifests)
      for (const dependency of manifest.dependencyIds) expect(ids.has(dependency)).toBe(true);
    expect([...ids]).not.toEqual(expect.arrayContaining(["video-text"]));
    expect([...ids]).not.toEqual(expect.arrayContaining(["whisper-small"]));
  });
  it.each(catalogs)("keeps all %s manifests verifiable", (platform, catalog) => {
    for (const manifest of catalog.manifests) {
      const publicKey = catalog.trustedPublicKeys[manifest.keyId];
      expect(publicKey, `${platform} ${manifest.id} must have a trusted public key`).toBeDefined();
      if (!publicKey) continue;

      expect(
        crypto.verify(
          null,
          Buffer.from(canonicalManifest(manifest)),
          publicKey,
          Buffer.from(manifest.signature, "base64")
        ),
        `${platform} ${manifest.id} manifest signature must be valid`
      ).toBe(true);
    }
  });
});
