import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultProductImageRecipe } from "@toolbox/shared";
import { renderProductImage } from "../modules/image-ai/product-image-renderer";
import { ownedImageFile, validateProductAsset } from "../modules/image-ai/product-image-files";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "product-render-test-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
async function image(
  name: string,
  width: number,
  height: number,
  background: string | { r: number; g: number; b: number; alpha: number }
) {
  const file = path.join(root, name);
  await sharp({ create: { width, height, channels: 4, background } })
    .png()
    .toFile(file);
  return file;
}
describe("商品图本地渲染", () => {
  it("换背景、等比标准化，保留未编辑 Alpha 和主体颜色", async () => {
    const foreground = await image("foreground.png", 4, 2, "#ff0000"),
      output = path.join(root, "out.png"),
      recipe = defaultProductImageRecipe();
    recipe.canvas = { width: 256, height: 256 };
    recipe.background = { kind: "color", color: "#00FF00" };
    const phases: string[] = [];
    await renderProductImage({ foreground }, recipe, output, (value) => phases.push(value));
    const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([256, 256]);
    expect([...data.subarray(0, 4)]).toEqual([0, 255, 0, 255]);
    const center = (128 * 256 + 128) * 4;
    expect([...data.subarray(center, center + 4)]).toEqual([255, 0, 0, 255]);
    expect(phases).toEqual(["应用精修", "计算布局", "合成图片"]);
  });
  it("恢复使用原图颜色，零增量不改变已有半透明边缘", async () => {
    const foreground = await image("foreground.png", 2, 2, { r: 0, g: 0, b: 0, alpha: 0 });
    const original = await image("original.png", 2, 2, "#ff0000"),
      restore = await image("restore.png", 2, 2, "#ffffff"),
      output = path.join(root, "out.png");
    const recipe = defaultProductImageRecipe();
    recipe.canvas = { width: 256, height: 256 };
    recipe.background.kind = "transparent";
    await renderProductImage({ foreground, original, restore }, recipe, output, () => undefined);
    const { data } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const center = (128 * 256 + 128) * 4;
    expect([...data.subarray(center, center + 4)]).toEqual([255, 0, 0, 255]);
    const semi = await image("semi.png", 2, 2, { r: 200, g: 80, b: 40, alpha: 0.5 });
    await renderProductImage({ foreground: semi }, recipe, output, () => undefined);
    const result = await sharp(output).ensureAlpha().raw().toBuffer();
    expect(result[center + 3]).toBeGreaterThanOrEqual(127);
    expect(result[center + 3]).toBeLessThanOrEqual(128);
  });
  it("全透明结果不能被误保存为成功", async () => {
    const foreground = await image("empty.png", 2, 2, { r: 0, g: 0, b: 0, alpha: 0 });
    await expect(
      renderProductImage({ foreground }, defaultProductImageRecipe(), path.join(root, "out.png"), () => undefined)
    ).rejects.toThrow("没有可见商品主体");
  });
  it("拒绝越界路径和跨任务文件", async () => {
    const spoof = path.join(root, "spoof.png");
    await fs.writeFile(spoof, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" />');
    await expect(validateProductAsset(spoof)).rejects.toThrow("真实的单帧");
    await fs.mkdir(path.join(root, "task-123"));
    await fs.mkdir(path.join(root, "task-456"));
    const sibling = path.join(root, "task-456", "private.png");
    await fs.writeFile(sibling, "x");
    await expect(ownedImageFile(root, "task-123", sibling)).rejects.toThrow("受控目录");
    await expect(ownedImageFile(root, "../task-456", sibling)).rejects.toThrow("来源记录无效");
  });
});
