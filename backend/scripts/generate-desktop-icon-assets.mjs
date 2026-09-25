import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const desktopAssetDirectory = path.join(repositoryRoot, "apps", "desktop", "assets");
const frontendPublicDirectory = path.join(repositoryRoot, "frontend", "public");
const masterPath = path.join(desktopAssetDirectory, "ecommerce-toolbox-icon-master.png");
const iconSizes = [16, 24, 32, 48, 256];
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function findVisibleAlphaBounds(pngBuffer, threshold = 8) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  assert.ok(right >= left && bottom >= top, "Icon source does not contain visible pixels");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export function createIco(entries) {
  assert.deepEqual(
    entries.map(({ size }) => size),
    [...entries.map(({ size }) => size)].sort((left, right) => left - right),
    "ICO image entries must be ordered from smallest to largest"
  );
  assert.equal(new Set(entries.map(({ size }) => size)).size, entries.length, "ICO sizes must be unique");
  assert.ok(entries.length > 0 && entries.length <= 0xffff, "ICO entry count is invalid");

  const directorySize = 6 + entries.length * 16;
  const directories = [];
  let imageOffset = directorySize;

  for (const { size, png } of entries) {
    assert.ok(size > 0 && size <= 256, `ICO size is invalid: ${size}`);
    assert.ok(png.subarray(0, 8).equals(pngSignature), `ICO ${size}px payload is not a PNG`);
    assert.equal(png.readUInt32BE(16), size, `ICO ${size}px payload width does not match its entry`);
    assert.equal(png.readUInt32BE(20), size, `ICO ${size}px payload height does not match its entry`);
    assert.ok(png.length <= 0xffffffff, `ICO ${size}px payload is too large`);

    const directoryEntry = Buffer.alloc(16);
    directoryEntry.writeUInt8(size === 256 ? 0 : size, 0);
    directoryEntry.writeUInt8(size === 256 ? 0 : size, 1);
    directoryEntry.writeUInt8(0, 2);
    directoryEntry.writeUInt8(0, 3);
    directoryEntry.writeUInt16LE(1, 4);
    directoryEntry.writeUInt16LE(32, 6);
    directoryEntry.writeUInt32LE(png.length, 8);
    directoryEntry.writeUInt32LE(imageOffset, 12);
    directories.push(directoryEntry);
    imageOffset += png.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  return Buffer.concat([header, ...directories, ...entries.map(({ png }) => png)]);
}

async function renderIconSize(source, bounds, size) {
  const padding = Math.max(1, Math.round(size * 0.06));
  const contentSize = size - padding * 2;
  const resized = await sharp(source)
    .extract(bounds)
    .resize(contentSize, contentSize, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((size - resized.info.width) / 2);
  const top = Math.floor((size - resized.info.height) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resized.data, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function generateDesktopIconAssets() {
  const source = await readFile(masterPath);
  const metadata = await sharp(source).metadata();
  assert.ok(metadata.width && metadata.height, "Icon source dimensions are unavailable");
  assert.ok(metadata.hasAlpha, "Icon source must preserve a transparent background");
  const bounds = await findVisibleAlphaBounds(source);
  const pngEntries = [];

  await mkdir(frontendPublicDirectory, { recursive: true });
  await sharp(source)
    .resize(1024, 1024, { fit: "contain", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(desktopAssetDirectory, "ecommerce-toolbox-icon-master-1024.png"));

  for (const size of iconSizes) {
    const png = await renderIconSize(source, bounds, size);
    const assetPath = path.join(desktopAssetDirectory, `ecommerce-toolbox-icon-${size}.png`);
    await writeFile(assetPath, png);
    pngEntries.push({ size, png });
  }

  const ico = createIco(pngEntries);
  await writeFile(path.join(desktopAssetDirectory, "ecommerce-toolbox.ico"), ico);
  await copyFile(
    path.join(desktopAssetDirectory, "ecommerce-toolbox.ico"),
    path.join(frontendPublicDirectory, "favicon.ico")
  );
  await copyFile(
    path.join(desktopAssetDirectory, "ecommerce-toolbox-icon-32.png"),
    path.join(frontendPublicDirectory, "favicon-32x32.png")
  );
  await copyFile(
    path.join(desktopAssetDirectory, "ecommerce-toolbox-icon-32.png"),
    path.join(frontendPublicDirectory, "ecommerce-toolbox-icon-32.png")
  );

  console.log(
    `Generated transparent 16/24/32/48/256px icons and a ${iconSizes.length}-size ICO from ${metadata.width}x${metadata.height} source artwork.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await generateDesktopIconAssets();
}
