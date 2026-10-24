import { Type, type Static } from "@sinclair/typebox";

export const ProductImageRecipeSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    canvas: Type.Object(
      { width: Type.Integer({ minimum: 256, maximum: 4096 }), height: Type.Integer({ minimum: 256, maximum: 4096 }) },
      { additionalProperties: false }
    ),
    background: Type.Object(
      {
        kind: Type.Union([Type.Literal("transparent"), Type.Literal("color"), Type.Literal("image")]),
        color: Type.String({ pattern: "^#[0-9a-fA-F]{6}$" })
      },
      { additionalProperties: false }
    ),
    layout: Type.Object(
      {
        fill: Type.Number({ minimum: 0.5, maximum: 0.95 }),
        align: Type.Union([Type.Literal("center"), Type.Literal("bottom")]),
        offsetX: Type.Number({ minimum: -1, maximum: 1 }),
        offsetY: Type.Number({ minimum: -1, maximum: 1 }),
        scale: Type.Number({ minimum: 0.1, maximum: 1 })
      },
      { additionalProperties: false }
    )
  },
  { additionalProperties: false }
);

export const ProductImageSourceSchema = Type.Object(
  {
    taskId: Type.String(),
    resultId: Type.String(),
    width: Type.Integer(),
    height: Type.Integer(),
    foregroundUrl: Type.String(),
    originalUrl: Type.Optional(Type.String()),
    backgroundUrl: Type.Optional(Type.String()),
    eraseUrl: Type.Optional(Type.String()),
    restoreUrl: Type.Optional(Type.String()),
    canRestore: Type.Boolean(),
    reason: Type.Optional(Type.String()),
    recipe: ProductImageRecipeSchema
  },
  { additionalProperties: false }
);

export type ProductImageRecipe = Static<typeof ProductImageRecipeSchema>;
export type ProductImageSource = Static<typeof ProductImageSourceSchema>;

export function defaultProductImageRecipe(): ProductImageRecipe {
  return {
    schemaVersion: 1,
    canvas: { width: 1600, height: 1600 },
    background: { kind: "color", color: "#FFFFFF" },
    layout: { fill: 0.8, align: "center", offsetX: 0, offsetY: 0, scale: 1 }
  };
}

/** Both preview and final renderer use integer geometry and clamp the entire subject inside the canvas. */
export function productImageLayout(
  width: number,
  height: number,
  subjectWidth: number,
  subjectHeight: number,
  layout: ProductImageRecipe["layout"]
) {
  if (
    ![width, height, subjectWidth, subjectHeight, layout.fill, layout.scale, layout.offsetX, layout.offsetY].every(
      Number.isFinite
    ) ||
    Math.min(width, height, subjectWidth, subjectHeight) <= 0
  )
    throw new Error("商品布局尺寸无效");
  const ratio = Math.min((width * layout.fill) / subjectWidth, (height * layout.fill) / subjectHeight) * layout.scale;
  const w = Math.max(1, Math.min(width, Math.round(subjectWidth * ratio)));
  const h = Math.max(1, Math.min(height, Math.round(subjectHeight * ratio)));
  return {
    width: w,
    height: h,
    left: Math.round(Math.max(0, Math.min(width - w, (width - w) / 2 + layout.offsetX * width))),
    top: Math.round(
      Math.max(
        0,
        Math.min(height - h, (layout.align === "bottom" ? height - h : (height - h) / 2) + layout.offsetY * height)
      )
    ),
    enlarged: ratio > 1
  };
}
