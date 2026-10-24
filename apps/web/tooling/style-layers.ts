import type { CSSOptions } from "vite";

type InlinePostcss = Exclude<NonNullable<CSSOptions["postcss"]>, string>;
type CssPlugin = Extract<NonNullable<InlinePostcss["plugins"]>[number], { postcssPlugin: string }>;

/** Recover the original two layer blocks after Vite expands the ordered CSS fragments. */
export function compactStyleLayers(): CssPlugin {
  return {
    postcssPlugin: "toolbox-contiguous-style-layers",
    OnceExit(root) {
      let fixedOrder = false;
      let previous: (typeof root.nodes)[number] | undefined;
      for (const node of [...root.nodes]) {
        if (node.type === "comment") continue;
        if (
          node.type === "atrule" &&
          node.name === "layer" &&
          !node.nodes &&
          node.params.replace(/\s/g, "") === "tokens,foundation,components"
        ) {
          fixedOrder = true;
          previous = undefined;
          continue;
        }
        if (
          !fixedOrder ||
          node.type !== "atrule" ||
          node.name !== "layer" ||
          !["foundation", "components"].includes(node.params)
        ) {
          previous = undefined;
          continue;
        }
        if (!node.nodes) {
          // This single-layer registration is already fixed by the preceding original three-layer declaration.
          node.remove();
          continue;
        }
        if (
          previous?.type === "atrule" &&
          previous.name === "layer" &&
          previous.params === node.params &&
          previous.nodes
        ) {
          previous.append(node.nodes.map((child) => child.clone()));
          node.remove();
        } else previous = node;
      }
    }
  };
}
