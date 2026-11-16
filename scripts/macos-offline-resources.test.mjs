import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inspectMacOfflineResources,
  macArchiveInventory,
  parseMacCatalogSource,
  prepareMacOfflineResources,
  sha256File
} from "./macos-offline-resources.mjs";

const bytes = Buffer.from("signed fixture archive");
const digest = createHash("sha256").update(bytes).digest("hex");

function catalogFor(archives = [{ filename: "component.tar.gz", bytes, sha256: digest }]) {
  const [primary, ...additional] = archives;
  const toMetadata = ({ filename, bytes: content, sha256 }) => ({
    url: `https://assets.example.test/${filename}`,
    bytes: content.length,
    sha256
  });
  return {
    manifests: [
      {
        id: "example-component",
        version: "1.0.0",
        platform: "darwin-arm64",
        archive: toMetadata(primary),
        additionalArchives: additional.map(toMetadata)
      }
    ]
  };
}

async function tempDirectory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "macos-offline-resources-"));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("macos-offline-resources-"));
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

test("generated Mac catalog parser and inventory match the current signed Apple Silicon catalog", async () => {
  const source = await fs.readFile(
    new URL("../apps/api/src/modules/components/catalog.darwin-arm64.generated.ts", import.meta.url),
    "utf8"
  );
  const catalog = parseMacCatalogSource(source);
  const inventory = macArchiveInventory(catalog);
  assert.equal(catalog.manifests.length, 10);
  assert.equal(inventory.length, 12);
  assert.ok(inventory.every((item) => item.url.startsWith("https://") && item.filename.endsWith(".tar.gz")));
  assert.throws(() => parseMacCatalogSource("export const packagedComponentCatalog = {};"), /generated JSON object/);
});

test("offline inventory reports all missing and corrupt archives without downloading", async (t) => {
  const root = await tempDirectory(t);
  const catalog = catalogFor([
    { filename: "component.tar.gz", bytes, sha256: digest },
    { filename: "model.tar.gz", bytes, sha256: digest }
  ]);
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, "component.tar.gz"), "wrong bytes");
  const result = await inspectMacOfflineResources(catalog, root);
  assert.equal(result.archives.length, 2);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].filename, "model.tar.gz");
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].filename, "component.tar.gz");
  assert.equal(result.totalBytes, bytes.length * 2);
});

test("explicit preparation verifies each downloaded archive and reuses valid files", async (t) => {
  const root = await tempDirectory(t);
  const catalog = catalogFor([
    { filename: "component.tar.gz", bytes, sha256: digest },
    { filename: "model.tar.gz", bytes, sha256: digest }
  ]);
  const reports = [];
  let requests = 0;
  const fetchImpl = async (url) => {
    requests += 1;
    assert.equal(new URL(url).protocol, "https:");
    return new Response(bytes);
  };
  assert.deepEqual(
    await prepareMacOfflineResources(catalog, root, { fetchImpl, report: (message) => reports.push(message) }),
    ["component.tar.gz", "model.tar.gz"]
  );
  assert.equal(requests, 2);
  assert.deepEqual(await sha256File(path.join(root, "component.tar.gz")), { sha256: digest, bytes: bytes.length });
  assert.equal((await inspectMacOfflineResources(catalog, root)).missing.length, 0);
  await prepareMacOfflineResources(catalog, root, { fetchImpl, report: (message) => reports.push(message) });
  assert.equal(requests, 2);
  assert.ok(reports.some((message) => message.includes("复用已校验归档")));
  assert.deepEqual((await fs.readdir(root)).sort(), ["component.tar.gz", "model.tar.gz"]);
});

test("digest mismatch removes the partial download and never installs the wrong bytes", async (t) => {
  const root = await tempDirectory(t);
  const catalog = catalogFor([{ filename: "component.tar.gz", bytes, sha256: "0".repeat(64) }]);
  await assert.rejects(
    prepareMacOfflineResources(catalog, root, { fetchImpl: async () => new Response(bytes) }),
    /下载校验失败/
  );
  assert.deepEqual(await fs.readdir(root), []);
});

test("explicit preparation follows HTTPS asset redirects and rejects HTTP or oversized responses", async (t) => {
  const root = await tempDirectory(t);
  const catalog = catalogFor();
  let requests = 0;
  await prepareMacOfflineResources(catalog, root, {
    fetchImpl: async (url, options) => {
      requests += 1;
      assert.equal(options.redirect, "manual");
      if (requests === 1)
        return new Response(null, { status: 302, headers: { location: "https://cdn.example.test/component.tar.gz" } });
      assert.equal(url, "https://cdn.example.test/component.tar.gz");
      return new Response(bytes);
    }
  });
  assert.equal(requests, 2);

  const httpRoot = await tempDirectory(t);
  await assert.rejects(
    prepareMacOfflineResources(catalog, httpRoot, {
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: "http://cdn.example.test/file" } })
    }),
    /拒绝跳转到非 HTTPS/
  );
  assert.deepEqual(await fs.readdir(httpRoot), []);

  const oversizedRoot = await tempDirectory(t);
  const oversized = catalogFor([{ filename: "component.tar.gz", bytes: Buffer.from("short"), sha256: digest }]);
  await assert.rejects(
    prepareMacOfflineResources(oversized, oversizedRoot, { fetchImpl: async () => new Response(bytes) }),
    /超过签名目录声明的/
  );
  assert.deepEqual(await fs.readdir(oversizedRoot), []);
});

test("inventory rejects non-Mac, unsafe, non-HTTPS, and duplicate archive names", () => {
  const valid = catalogFor();
  assert.throws(
    () => macArchiveInventory({ manifests: [{ ...valid.manifests[0], platform: "win32-x64" }] }),
    /Non-Mac/
  );
  const unsafeCatalog = catalogFor();
  unsafeCatalog.manifests[0].archive.url = "https://assets.example.test/prefix%2F..%2Fescape.tar.gz";
  assert.throws(() => macArchiveInventory(unsafeCatalog), /Invalid signed Mac archive metadata/);
  const httpCatalog = catalogFor();
  httpCatalog.manifests[0].archive.url = "http://assets.example.test/component.tar.gz";
  assert.throws(() => macArchiveInventory(httpCatalog), /Invalid signed Mac archive metadata/);
  const duplicateCatalog = catalogFor([
    { filename: "same.tar.gz", bytes, sha256: digest },
    { filename: "same.tar.gz", bytes, sha256: digest }
  ]);
  assert.throws(() => macArchiveInventory(duplicateCatalog), /Duplicate Mac archive filename/);
});
