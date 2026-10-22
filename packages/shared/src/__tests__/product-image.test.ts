import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { ProductImageRecipeSchema, defaultProductImageRecipe, productImageLayout } from "../product-image";
import { isImageWorkerProcess } from "../worker-protocol";

describe("商品图配方与布局", () => {
  it("本地合成提供者不进入 Python Worker 协议", () => {
    expect(isImageWorkerProcess({ provider: "sharp", model: "商品图渲染器 v1", warnings: [] })).toBe(false);
  });
  it("接受默认配方，拒绝未知字段、非法颜色及尺寸", () => {
    const recipe = defaultProductImageRecipe();
    expect(Value.Check(ProductImageRecipeSchema, recipe)).toBe(true);
    expect(Value.Check(ProductImageRecipeSchema, { ...recipe, path: "C:/secret" })).toBe(false);
    expect(Value.Check(ProductImageRecipeSchema, { ...recipe, background: { kind: "color", color: "url(x)" } })).toBe(
      false
    );
    expect(Value.Check(ProductImageRecipeSchema, { ...recipe, canvas: { width: 5000, height: 1600 } })).toBe(false);
  });
  it("等比居中、底对齐及拖动边界一致", () => {
    const { layout } = defaultProductImageRecipe();
    expect(productImageLayout(1600, 1600, 800, 400, layout)).toEqual({
      width: 1280,
      height: 640,
      left: 160,
      top: 480,
      enlarged: true
    });
    expect(productImageLayout(1600, 1600, 800, 400, { ...layout, align: "bottom", offsetX: 1 })).toMatchObject({
      left: 320,
      top: 960
    });
    expect(() => productImageLayout(1600, 1600, 0, 400, layout)).toThrow();
  });
});
