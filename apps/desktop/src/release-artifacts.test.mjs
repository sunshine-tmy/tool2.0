import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyReleaseArtifacts } from "../scripts/verify-release-artifacts.mjs";

let root;
afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("NSIS release artifacts", () => {
  it("accepts latest.yml only when its setup SHA-512 matches", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-release-artifacts-"));
    const setup = Buffer.from("signed NSIS setup");
    const digest = createHash("sha512").update(setup).digest("base64");
    await fs.writeFile(path.join(root, "EcommerceToolboxSetup.exe"), setup);
    await fs.writeFile(path.join(root, "EcommerceToolboxSetup.exe.blockmap"), "{}\n");
    await fs.writeFile(
      path.join(root, "latest.yml"),
      `version: 1.2.3\nfiles:\n  - url: EcommerceToolboxSetup.exe\n    sha512: ${digest}\n`
    );
    await expect(verifyReleaseArtifacts(root, "1.2.3")).resolves.toBeUndefined();
    await expect(verifyReleaseArtifacts(root, "1.2.4")).rejects.toThrow("version must match");
    await fs.writeFile(path.join(root, "EcommerceToolboxSetup.exe"), "tampered");
    await expect(verifyReleaseArtifacts(root)).rejects.toThrow("Setup SHA-512 mismatch");
  });
});
