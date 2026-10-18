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
