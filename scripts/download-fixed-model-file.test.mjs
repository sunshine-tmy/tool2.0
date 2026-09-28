/** 中文模块说明：验证固定资产下载器的 HTTPS 限制、流式内容与摘要失败清理。 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { downloadFixedFile } from "./download-fixed-model-file.mjs";

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fixed-download-test-"));
test.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

test("downloads HTTPS content and validates its fixed SHA-256", async () => {
  const content = Buffer.from("pinned model fixture");
  const destination = path.join(temporaryRoot, "nested", "model.bin");
  const expectedSha256 = createHash("sha256").update(content).digest("hex");
  const fetchImpl = async (url, options) => {
    assert.equal(url.href, "https://assets.example.test/model.bin");
    assert.equal(options.redirect, "follow");
    return new Response(content);
  };

  await downloadFixedFile({
    url: "https://assets.example.test/model.bin",
    destination,
    expectedSha256,
    fetchImpl
  });

  assert.deepEqual(await fs.readFile(destination), content);
});

test("removes incomplete output when the downloaded bytes do not match the pin", async () => {
  const destination = path.join(temporaryRoot, "tampered.bin");
  await assert.rejects(
    downloadFixedFile({
      url: "https://assets.example.test/model.bin",
      destination,
      expectedSha256: "0".repeat(64),
      fetchImpl: async () => new Response("tampered")
    }),
    /SHA-256 校验失败/
  );
  await assert.rejects(fs.access(destination), { code: "ENOENT" });
});

test("rejects non-HTTPS source URLs before making a request", async () => {
  let requested = false;
  await assert.rejects(
    downloadFixedFile({
      url: "http://assets.example.test/model.bin",
      destination: path.join(temporaryRoot, "insecure.bin"),
      fetchImpl: async () => {
        requested = true;
        return new Response("unexpected");
      }
    }),
    /必须使用 HTTPS/
  );
  assert.equal(requested, false);
});
