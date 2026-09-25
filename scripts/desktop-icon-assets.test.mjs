import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createIco, findVisibleAlphaBounds } from "../backend/scripts/generate-desktop-icon-assets.mjs";

const requireBackendDependency = createRequire(new URL("../backend/package.json", import.meta.url));
const sharp = requireBackendDependency("sharp");

test("findVisibleAlphaBounds ignores fully transparent padding and alpha dust", async () => {
  const pixels = Buffer.alloc(6 * 5 * 4);
  pixels[(1 * 6 + 2) * 4 + 3] = 255;
  pixels[(3 * 6 + 4) * 4 + 3] = 255;
  pixels[3] = 2;
  const source = await sharp(pixels, { raw: { width: 6, height: 5, channels: 4 } })
    .png()
    .toBuffer();

  assert.deepEqual(await findVisibleAlphaBounds(source), { left: 2, top: 1, width: 3, height: 3 });
});

test("createIco writes valid, ordered PNG-backed Windows icon entries", async () => {
  const sizes = [16, 24, 32, 48, 256];
  const entries = await Promise.all(
    sizes.map(async (size) => ({
      size,
      png: await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: size, g: 80, b: 190, alpha: 0.8 }
        }
      })
        .png()
        .toBuffer()
    }))
  );
  const ico = createIco(entries);

  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), sizes.length);

  for (const [index, size] of sizes.entries()) {
    const entryOffset = 6 + index * 16;
    const storedSize = size === 256 ? 0 : size;
    const payloadSize = ico.readUInt32LE(entryOffset + 8);
    const payloadOffset = ico.readUInt32LE(entryOffset + 12);
    const payload = ico.subarray(payloadOffset, payloadOffset + payloadSize);
    assert.equal(ico.readUInt8(entryOffset), storedSize);
    assert.equal(ico.readUInt8(entryOffset + 1), storedSize);
    assert.equal(ico.readUInt16LE(entryOffset + 4), 1);
    assert.equal(ico.readUInt16LE(entryOffset + 6), 32);
    assert.equal(payload.readUInt32BE(16), size);
    assert.equal(payload.readUInt32BE(20), size);
  }
});

test("createIco rejects duplicate or misordered icon dimensions", () => {
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.writeUInt32BE(16, 16);
  png.writeUInt32BE(16, 20);
  assert.throws(
    () =>
      createIco([
        { size: 32, png },
        { size: 16, png }
      ]),
    /ordered/
  );
});
