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

describe("Squirrel release artifacts", () => {
  it("accepts a setup executable and a RELEASES entry only when the package size and digest match", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-release-artifacts-"));
    const packageName = "EcommerceToolbox-1.2.3-full.nupkg";
    const contents = Buffer.from("signed package content");
    await fs.writeFile(path.join(root, "EcommerceToolboxSetup.exe"), "setup", "utf8");
    await fs.writeFile(path.join(root, packageName), contents);
    const digest = createHash("sha1").update(contents).digest("hex").toUpperCase();
    await fs.writeFile(path.join(root, "RELEASES"), `${digest} ${packageName} ${contents.length}\n`, "utf8");

    await expect(verifyReleaseArtifacts(root)).resolves.toBeUndefined();
    await fs.writeFile(path.join(root, packageName), "tampered", "utf8");
    await expect(verifyReleaseArtifacts(root)).rejects.toThrow("Package size mismatch");
  });
});
