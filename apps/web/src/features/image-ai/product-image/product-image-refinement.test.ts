import { describe, expect, it } from "vitest";
import { createRefinement, refinePixels } from "./product-image-refinement";

describe("商品精修", () => {
  it("画布外的指针不会生成负尺寸区域或修改蒙版", () => {
    const editor = createRefinement(10, 10);
    editor.begin();
    expect(editor.paint(-100, -100, 4, 1, "erase")).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    editor.end();
    expect(editor.erase.every((value) => value === 0)).toBe(true);
    expect(editor.canUndo).toBe(false);
  });
  it("最新笔触覆盖相反操作，并支持撤销重做", () => {
    const editor = createRefinement(5, 5);
    editor.begin();
    editor.paint(2, 2, 1, 1, "erase");
    editor.end();
    expect(editor.erase[12]).toBe(255);
    editor.begin();
    editor.paint(2, 2, 1, 1, "restore");
    editor.end();
    expect(editor.erase[12]).toBe(0);
    expect(editor.restore[12]).toBe(255);
    editor.undo();
    expect(editor.erase[12]).toBe(255);
    expect(editor.restore[12]).toBe(0);
    editor.redo();
    expect(editor.restore[12]).toBe(255);
  });
  it("恢复使用原图色彩，不能把原图透明区域变成黑块", () => {
    const out = new Uint8ClampedArray(8);
    refinePixels(
      new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0]),
      new Uint8ClampedArray([240, 20, 10, 255, 0, 0, 0, 0]),
      new Uint8ClampedArray(2),
      new Uint8ClampedArray([255, 255]),
      out,
      2,
      { left: 0, top: 0, width: 2, height: 1 }
    );
    expect([...out]).toEqual([240, 20, 10, 255, 0, 0, 0, 0]);
  });
  it("淘汰超预算历史，不改变已编辑像素", () => {
    const editor = createRefinement(10, 10, undefined, undefined, 128);
    editor.begin();
    editor.paint(5, 5, 4, 1, "erase");
    editor.end();
    expect(editor.historyBytes).toBeLessThanOrEqual(128);
    expect(editor.canUndo).toBe(false);
    expect(editor.erase[55]).toBe(255);
  });
});
