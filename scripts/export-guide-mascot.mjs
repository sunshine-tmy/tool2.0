// Export locally generated mascot art; Sharp is already an API workspace dependency.
import { createRequire } from "node:module";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(path.join(root, "apps/api/package.json"))("sharp");
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((value, i, all) => (value.startsWith("--") ? [value.slice(2), all[i + 1]] : []))
    .filter((entry) => entry.length)
);
for (const key of ["master", "half", "closed", "body"]) if (!args[key]) throw new Error(`Missing --${key}`);
const sourceDir = path.join(root, "docs/design/ui-v2/mascot-source");
const out = path.join(root, "apps/web/src/shared/onboarding/assets");
await mkdir(sourceDir, { recursive: true });
await mkdir(out, { recursive: true });
const size = 1280;
async function normalize(file) {
  const { data, info } = await sharp(file)
    .resize(size, size, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Remove near-transparent export dust, preserving the antialiased silhouette.
  for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] < 16) data.fill(0, i, i + 4);
  return sharp(data, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
}
const art = {};
for (const key of ["master", "half", "closed", "body"]) {
  const sourceCopy = path.join(sourceDir, `unicorn-${key}.png`);
  if (path.resolve(args[key]) !== sourceCopy) await copyFile(args[key], sourceCopy);
  art[key] = await normalize(args[key]);
}
const svg = (content) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1280">${content}</svg>`);
const pawMask = svg(
  '<path fill="white" d="M808 755 C854 780 944 859 973 923 C999 984 915 1025 876 978 C850 941 828 872 810 829 C800 801 795 773 808 755Z"/>'
);
const paw = await sharp(art.master)
  .composite([{ input: pawMask, blend: "dest-in" }])
  .png()
  .toBuffer();
// Freeze the master everywhere except the small region behind the moving paw.
const region = { left: 780, top: 735, width: 235, height: 295 };
const blank = await sharp(art.master)
  .composite([{ input: svg('<rect x="780" y="735" width="235" height="295" fill="white"/>'), blend: "dest-out" }])
  .png()
  .toBuffer();
const patch = await sharp(art.body).extract(region).png().toBuffer();
const body = await sharp(blank)
  .composite([{ input: patch, left: region.left, top: region.top }])
  .png()
  .toBuffer();
const eyesMask = await sharp(
  svg(
    '<ellipse cx="474" cy="514" rx="110" ry="111" fill="white"/><ellipse cx="788" cy="514" rx="110" ry="111" fill="white"/>'
  )
)
  .blur(3)
  .png()
  .toBuffer();
async function blink(frame) {
  const eyes = await sharp(frame)
    .composite([{ input: eyesMask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(body)
    .composite([{ input: eyes }])
    .png()
    .toBuffer();
}
const frames = {
  idle: await sharp(body)
    .composite([{ input: paw }])
    .png()
    .toBuffer(),
  body,
  paw,
  half: await blink(art.half),
  closed: await blink(art.closed)
};
const manifest = { canvas: [240, 240], sourceCanvas: [size, size], pawOrigin: [823 / size, 771 / size], files: {} };
for (const [name, buffer] of Object.entries(frames)) {
  const output = await sharp(buffer).resize(240, 240).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
  await writeFile(path.join(out, `unicorn-${name}.webp`), output);
  manifest.files[name] = output.length;
}
await writeFile(path.join(out, "unicorn-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
