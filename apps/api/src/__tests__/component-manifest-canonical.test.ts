import { expect, expectTypeOf, it } from "vitest";
import {
  canonicalManifest,
  type ComponentPackageManifest,
  type ComponentManifestFile,
  type ComponentArchiveAsset,
  type ComponentAssembledFile
} from "../modules/components/component-manager";

const manifest: ComponentPackageManifest = {
  protocolVersion: 1,
  id: "fixture",
  moduleId: "fixture",
  groupId: "shared",
  displayName: "合成 fixture",
  purpose: "canonical regression",
  dependencyIds: ["first", "second"],
  taskToolIds: [],
  installConditions: [],
  version: "1.0.0",
  platform: "win32-x64",
  archive: { url: "https://fixture.test/fixture.tar.gz", bytes: 1, sha256: "a".repeat(64), format: "tar.gz" },
  installedBytes: 1,
  files: [{ path: "fixture.txt", bytes: 1, sha256: "b".repeat(64) }],
  sbom: { url: "https://fixture.test/sbom.json", sha256: "c".repeat(64) },
  keyId: "test-only",
  signature: "synthetic-not-a-real-signature"
};
it("keeps the original public file/archive/assembly type exports structurally identical", () => {
  expectTypeOf<ComponentManifestFile>().toEqualTypeOf<ComponentPackageManifest["files"][number]>();
  expectTypeOf<ComponentArchiveAsset>().toEqualTypeOf<ComponentPackageManifest["archive"]>();
  expectTypeOf<ComponentAssembledFile>().toEqualTypeOf<
    NonNullable<ComponentPackageManifest["assembledFiles"]>[number]
  >();
});
it("sorts object keys recursively and excludes only the signature field", () => {
  const { id, archive, ...rest } = manifest;
  const { url, ...archiveRest } = archive;
  const reordered = { ...rest, archive: { ...archiveRest, url }, id, signature: "other" };
  expect(canonicalManifest(reordered)).toBe(canonicalManifest(manifest));
  expect(JSON.parse(canonicalManifest(manifest))).not.toHaveProperty("signature");
  const extended = { ...manifest, extension: "额外字段" };
  expect(canonicalManifest(extended)).toContain('"extension":"额外字段"');
  expect(canonicalManifest({ ...manifest, dependencyIds: ["second", "first"] })).not.toBe(canonicalManifest(manifest));
});
it("preserves existing JSON scalar encoding without adding manifest validation", () => {
  const extended = { ...manifest, extension: [null, true, -0, NaN, Infinity, '引号"\n'] };
  const text = canonicalManifest(extended);
  expect(JSON.parse(text).extension).toEqual([null, true, 0, null, null, '引号"\n']);
});
it.each([undefined, 1n, Symbol("fixture"), () => 1])("rejects unsupported canonical extension %s", (extension) => {
  const extended = { ...manifest, extension };
  expect(() => canonicalManifest(extended)).toThrow("Manifest contains an unsupported value");
});
