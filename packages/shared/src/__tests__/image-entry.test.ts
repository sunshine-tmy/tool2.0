import { describe, expect, expectTypeOf, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import * as root from "../index";
import * as image from "../image/index";
import * as options from "../image/image-options";
import * as ai from "../image/image-ai";
import * as product from "../image/product-image";
import * as compression from "../image/compress-result";

describe("image-domain compatibility entry", () => {
  it("exports exactly the existing image contracts, not unrelated domains", () => {
    expect(Object.keys(image).sort()).toEqual(Object.keys({ ...options, ...ai, ...product, ...compression }).sort());
    expect(image).not.toHaveProperty("ContentArchiveTaskSchema");
    expect(image).not.toHaveProperty("listTools");
  });

  it("reuses every original schema, function and constant without parallel implementations", () => {
    for (const [name, value] of Object.entries({ ...options, ...ai, ...product, ...compression })) {
      expect(Reflect.get(image, name), name).toBe(value);
      expect(Reflect.get(root, name), name).toBe(value);
    }
  });

  it("keeps root and domain types identical, including optional source fields", () => {
    expectTypeOf<image.ProductImageRecipe>().toEqualTypeOf<root.ProductImageRecipe>();
    expectTypeOf<image.ImageAiTask>().toEqualTypeOf<root.ImageAiTask>();
    expectTypeOf<image.ImageOptions>().toEqualTypeOf<root.ImageOptions>();
    expectTypeOf<image.ImageCompressResult>().toEqualTypeOf<root.ImageCompressResult>();
    expectTypeOf<image.ProductImageSource["originalUrl"]>().toEqualTypeOf<string | undefined>();
  });

  it("preserves validation and detailed errors for accepted and rejected recipes", () => {
    const recipe = root.defaultProductImageRecipe();
    const samples = [
      recipe,
      { ...recipe, extra: true },
      { ...recipe, background: { kind: "transparent", color: "#FFFFFF" } },
      { ...recipe, background: { kind: "color", color: null } },
      { ...recipe, canvas: { width: 255, height: 1600 } },
      { ...recipe, layout: { ...recipe.layout, scale: 1.1 } }
    ];
    for (const sample of samples) {
      expect(Value.Check(image.ProductImageRecipeSchema, sample)).toBe(
        Value.Check(root.ProductImageRecipeSchema, sample)
      );
      expect([...Value.Errors(image.ProductImageRecipeSchema, sample)]).toEqual([
        ...Value.Errors(root.ProductImageRecipeSchema, sample)
      ]);
    }
    expect(Value.Check(image.ProductImageRecipeSchema, recipe)).toBe(true);
    expect(Value.Check(image.ProductImageRecipeSchema, samples[1])).toBe(false);
  });

  it("preserves normalization defaults and product layout results", () => {
    for (const input of [{}, { quality: 12, outputFormat: "webp", width: 100 }]) {
      expect(image.normalizeImageOptions(input)).toEqual(root.normalizeImageOptions(input));
    }
    expect(image.defaultProductImageRecipe()).toEqual(root.defaultProductImageRecipe());
    const recipe = image.defaultProductImageRecipe();
    expect(image.productImageLayout(1600, 1600, 800, 400, recipe.layout)).toEqual(
      root.productImageLayout(1600, 1600, 800, 400, recipe.layout)
    );
  });
});
