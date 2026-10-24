import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { productImageLayout, type ProductImageRecipe } from "@toolbox/shared";

export type ProductImageAssets = {
  foreground: string;
  original?: string;
  background?: string;
  erase?: string;
  restore?: string;
};

/** Internal-only worker program, never constructed from request code. Native Sharp stays in the worker too. */
const program = String.raw`
const { parentPort, workerData: d } = require('node:worker_threads');
const sharp = require(d.sharp);
const layout = (${productImageLayout.toString()});
const phase = text => parentPort.postMessage({ phase: text });
(async () => {
  phase('应用精修');
  const { data: base, info } = await sharp(d.assets.foreground, { limitInputPixels: 40000000 }).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const out = Buffer.from(base);
  let original;
  if (d.assets.restore) {
    if (!d.assets.original) throw new Error('原图缺失，不能恢复商品区域');
    const image = await sharp(d.assets.original, { limitInputPixels: 40000000 }).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (image.info.width !== w || image.info.height !== h) throw new Error('原图与抠图坐标不一致');
    original = image.data;
  }
  const readMask = async file => file ? sharp(file, { limitInputPixels: 4194304 }).removeAlpha().greyscale().resize(w, h, { fit: 'fill', kernel: 'linear' }).raw().toBuffer() : undefined;
  const erase = await readMask(d.assets.erase), restore = await readMask(d.assets.restore);
  let left = w, top = h, right = -1, bottom = -1;
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    let e = (erase?.[p] || 0) / 255, r = (restore?.[p] || 0) / 255;
    if (e + r > 1) { const sum = e + r; e /= sum; r /= sum; }
    if (e || r) {
      const a = base[i + 3] / 255 * (1 - e - r), b = (original?.[i + 3] || 0) / 255 * r;
      const alpha = a + b;
      for (let c = 0; c < 3; c++) out[i + c] = alpha ? Math.round((base[i+c] * a + (original?.[i+c] || 0) * b) / alpha) : 0;
      out[i+3] = Math.round(alpha * 255);
    }
    if (out[i + 3] > 0) { const x = p % w, y = Math.floor(p / w); left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (right < left) throw new Error('没有可见商品主体，请恢复部分商品后再保存');
  phase('计算布局');
  const recipe = d.recipe, cw = recipe.canvas.width, ch = recipe.canvas.height;
  const box = { left, top, width: right-left+1, height: bottom-top+1 };
  const place = layout(cw, ch, box.width, box.height, recipe.layout);
  const subject = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).extract(box).resize(place.width, place.height).png().toBuffer();
  phase('合成图片');
  let canvas;
  if (recipe.background.kind === 'image') {
    if (!d.assets.background) throw new Error('请选择背景图片');
    canvas = sharp(d.assets.background, { limitInputPixels: 40000000 }).autoOrient().toColourspace('srgb').flatten({ background: '#ffffff' }).resize(cw, ch, { fit: 'cover', position: 'centre' }).ensureAlpha();
  } else {
    canvas = sharp({ create: { width: cw, height: ch, channels: 4, background: recipe.background.kind === 'transparent' ? { r:0,g:0,b:0,alpha:0 } : recipe.background.color } });
  }
  await canvas.composite([{ input: subject, left: place.left, top: place.top }]).png().toFile(d.output);
  parentPort.postMessage({ done: true, enlarged: place.enlarged });
})().catch(error => parentPort.postMessage({ error: error.message, code: ['ENOSPC','ENOENT','EACCES','EPERM'].includes(error.code) ? error.code : undefined }));
`;

export async function renderProductImage(
  assets: ProductImageAssets,
  recipe: ProductImageRecipe,
  output: string,
  phase: (value: string) => void
) {
  const worker = new Worker(program, {
    eval: true,
    // The fixed program is CommonJS; do not inherit a launcher's --input-type/TS loaders.
    execArgv: [],
    workerData: { assets, recipe, output, sharp: createRequire(import.meta.url).resolve("sharp") }
  });
  return new Promise<{ enlarged: boolean }>((resolve, reject) => {
    let settled = false;
    let result: { enlarged: boolean } | undefined;
    let failure: Error | undefined;
    worker.on(
      "message",
      (message: { phase?: string; done?: boolean; error?: string; code?: string; enlarged?: boolean }) => {
        if (message.phase) phase(message.phase);
        if (message.error) failure = Object.assign(new Error(message.error), { code: message.code });
        if (message.done) result = { enlarged: Boolean(message.enlarged) };
      }
    );
    worker.on("error", (error) => {
      failure = error;
    });
    // Wait for the thread to finish before the caller can clean its files or start another render.
    worker.on("exit", (code) => {
      if (settled) return;
      settled = true;
      if (failure || code !== 0 || !result) reject(failure ?? new Error("商品图渲染未正常完成"));
      else resolve(result);
    });
  });
}
