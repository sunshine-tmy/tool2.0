/** B10 uses real Sharp encoders and isolated synthetic images, never user media. */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { ImageFileGateway } from "../domains/image-compress/file-gateway";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
});
afterEach(async () => {
  await fixture.dispose();
});

describe.each(["jpeg", "png", "webp"] as const)("%s output dimensions", (outputFormat) => {
  it.each([
    { label: "no resize", orientation: undefined, width: undefined, expected: [64, 48] },
    { label: "downscale", orientation: undefined, width: 32, expected: [32, 24] },
    { label: "no enlargement", orientation: undefined, width: 800, expected: [64, 48] },
    { label: "EXIF 6 rotation", orientation: 6, width: undefined, expected: [48, 64] },
    { label: "EXIF 8 with resize", orientation: 8, width: 24, expected: [24, 32] },
    { label: "EXIF 6 without enlargement", orientation: 6, width: 800, expected: [48, 64] }
  ])("matches encoded pixels for $label", async ({ orientation, width, expected }) => {
    const config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
    const source = sharp({ create: { width: 64, height: 48, channels: 3, background: "#2563eb" } });
    const input = orientation
      ? await source.jpeg().withMetadata({ orientation }).toBuffer()
      : await source.png().toBuffer();
    const target = path.join(config.outputDir, `synthetic.${outputFormat}`);
    const result = await new ImageFileGateway(config).compress(input, target, { quality: 78, outputFormat, width });
    // Decode a buffer: libvips may retain filename-based WebP handles on Windows beyond this test.
    const output = await fs.readFile(target);
    const metadata = await sharp(output).metadata();
    expect([metadata.width, metadata.height]).toEqual(expected);
    expect([result.width, result.height]).toEqual(expected);
    expect(metadata.format).toBe(outputFormat);
    expect(result.outputSize).toBe((await fs.stat(target)).size);
    let encoder = sharp(input).rotate();
    if (width) encoder = encoder.resize({ width, withoutEnlargement: true });
    const originalEncoding = await encoder.toFormat(outputFormat, { quality: 78 }).toBuffer();
    expect(output).toEqual(originalEncoding);
    expect((await fs.readdir(config.outputDir)).filter((file) => file !== path.basename(target))).toEqual([]);
  });
});
