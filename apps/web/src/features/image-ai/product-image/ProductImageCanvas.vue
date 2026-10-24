<template>
  <div ref="viewport" class="product-viewport" :style="{ background: checkColor || undefined }">
    <div class="product-canvas-wrap">
      <canvas
        ref="display"
        :style="{
          width: `${displayWidth * zoom}px`,
          height: `${displayHeight * zoom}px`,
          cursor: tool === 'pan' ? 'grab' : tool === 'layout' ? 'move' : 'crosshair'
        }"
        aria-label="商品图编辑画布"
        @pointerdown="start"
        @pointermove="move"
        @pointerup="stop"
        @pointercancel="stop"
        @lostpointercapture="stop"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { productImageLayout, type ProductImageRecipe, type ProductImageSource } from "@toolbox/shared";
import { absoluteImageAiUrl } from "../media-links";
import { createRefinement, refinePixels } from "./product-image-refinement";

const props = defineProps<{
  source: ProductImageSource;
  recipe: ProductImageRecipe;
  backgroundUrl?: string;
  tool: "layout" | "pan" | "erase" | "restore";
  subjectView: boolean;
  brush: number;
  strength: number;
  zoom: number;
  checkColor: string;
  disabled: boolean;
}>();
const emit = defineEmits<{
  dirty: [];
  ready: [];
  error: [message: string];
  offset: [x: number, y: number];
  history: [undo: boolean, redo: boolean];
}>();
const display = ref<HTMLCanvasElement>(),
  viewport = ref<HTMLDivElement>();
const displayWidth = ref(640),
  displayHeight = ref(480);
let foreground: HTMLCanvasElement | undefined,
  base: ImageData | undefined,
  original: ImageData | undefined,
  pixels: ImageData | undefined;
let refinement: ReturnType<typeof createRefinement> | undefined;
let background: HTMLImageElement | undefined;
let alive = true,
  generation = 0,
  backgroundGeneration = 0;
let pointer:
  | {
      id: number;
      x: number;
      y: number;
      scrollLeft: number;
      scrollTop: number;
      offsetX: number;
      offsetY: number;
      lastX: number;
      lastY: number;
    }
  | undefined;
const images = new Set<HTMLImageElement>();

function canvas(width: number, height: number) {
  const value = document.createElement("canvas");
  value.width = width;
  value.height = height;
  return value;
}
function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    images.add(image);
    if (!url.startsWith("blob:")) image.crossOrigin = "use-credentials";
    image.onload = () => {
      images.delete(image);
      resolve(image);
    };
    image.onerror = () => {
      images.delete(image);
      reject(new Error("编辑图片读取失败，请检查记录是否仍然存在"));
    };
    image.src = url.startsWith("blob:") ? url : absoluteImageAiUrl(url);
  });
}
async function loadSource() {
  const token = ++generation;
  try {
    const image = await loadImage(props.source.foregroundUrl);
    const originalImage = props.source.originalUrl ? await loadImage(props.source.originalUrl) : undefined;
    const masks = await Promise.all(
      [props.source.eraseUrl, props.source.restoreUrl].map(async (url) => (url ? loadImage(url) : undefined))
    );
    if (!alive || token !== generation) return;
    foreground = canvas(image.naturalWidth, image.naturalHeight);
    const context = foreground.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    base = context.getImageData(0, 0, foreground.width, foreground.height);
    pixels = new ImageData(base.data.slice(), base.width, base.height);
    original = undefined;
    if (originalImage) {
      context.clearRect(0, 0, foreground.width, foreground.height);
      context.drawImage(originalImage, 0, 0, foreground.width, foreground.height);
      original = context.getImageData(0, 0, foreground.width, foreground.height);
    }
    const weights = masks.map((mask) => {
      if (!mask) return undefined;
      context.clearRect(0, 0, foreground!.width, foreground!.height);
      context.drawImage(mask, 0, 0, foreground!.width, foreground!.height);
      const data = context.getImageData(0, 0, foreground!.width, foreground!.height).data;
      const weights = new Uint8ClampedArray(foreground!.width * foreground!.height);
      for (let index = 0; index < weights.length; index++) weights[index] = data[index * 4];
      return weights;
    });
    refinement = createRefinement(base.width, base.height, weights[0], weights[1]);
    rebuild();
    emit("ready");
  } catch (error) {
    if (alive && token === generation) emit("error", error instanceof Error ? error.message : "编辑素材加载失败");
  }
}
function rebuild(rect = { left: 0, top: 0, width: base?.width ?? 0, height: base?.height ?? 0 }) {
  if (!base || !pixels || !foreground || !refinement) return;
  refinePixels(base.data, original?.data, refinement.erase, refinement.restore, pixels.data, base.width, rect);
  foreground.getContext("2d")!.putImageData(pixels, 0, 0, rect.left, rect.top, rect.width, rect.height);
  render();
  emit("history", refinement.canUndo, refinement.canRedo);
}
function subjectBox() {
  if (!pixels) return undefined;
  let left = pixels.width,
    top = pixels.height,
    right = -1,
    bottom = -1;
  for (let p = 0; p < pixels.width * pixels.height; p++)
    if (pixels.data[p * 4 + 3]) {
      const x = p % pixels.width,
        y = Math.floor(p / pixels.width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  return right < left ? undefined : { left, top, width: right - left + 1, height: bottom - top + 1 };
}
function render() {
  const target = display.value;
  if (!target || !foreground || !base) return;
  const w = props.subjectView ? base.width : props.recipe.canvas.width,
    h = props.subjectView ? base.height : props.recipe.canvas.height;
  const ratio = Math.min(1, 800 / w, 560 / h);
  target.width = Math.max(1, Math.round(w * ratio));
  target.height = Math.max(1, Math.round(h * ratio));
  displayWidth.value = target.width;
  displayHeight.value = target.height;
  const context = target.getContext("2d")!;
  context.clearRect(0, 0, target.width, target.height);
  if (props.subjectView) {
    context.drawImage(foreground, 0, 0, target.width, target.height);
    return;
  }
  const bg = props.recipe.background;
  if (bg.kind === "color") {
    context.fillStyle = bg.color;
    context.fillRect(0, 0, target.width, target.height);
  }
  if (bg.kind === "image" && background) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, target.width, target.height);
    const scale = Math.max(target.width / background.naturalWidth, target.height / background.naturalHeight);
    context.drawImage(
      background,
      (target.width - background.naturalWidth * scale) / 2,
      (target.height - background.naturalHeight * scale) / 2,
      background.naturalWidth * scale,
      background.naturalHeight * scale
    );
  }
  const box = subjectBox();
  if (box) {
    const place = productImageLayout(w, h, box.width, box.height, props.recipe.layout);
    context.drawImage(
      foreground,
      box.left,
      box.top,
      box.width,
      box.height,
      place.left * ratio,
      place.top * ratio,
      place.width * ratio,
      place.height * ratio
    );
  }
}
function coordinates(event: PointerEvent) {
  const bounds = display.value!.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * (base?.width ?? 1),
    y: ((event.clientY - bounds.top) / bounds.height) * (base?.height ?? 1)
  };
}
function start(event: PointerEvent) {
  if (props.disabled || !refinement || !base || event.button !== 0 || pointer) return;
  if (props.tool === "restore" && !props.source.canRestore) return;
  event.preventDefault();
  display.value!.setPointerCapture(event.pointerId);
  const point = coordinates(event);
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    scrollLeft: viewport.value!.scrollLeft,
    scrollTop: viewport.value!.scrollTop,
    offsetX: props.recipe.layout.offsetX,
    offsetY: props.recipe.layout.offsetY,
    lastX: point.x,
    lastY: point.y
  };
  if (props.tool === "erase" || props.tool === "restore") {
    refinement.begin();
    const rect = paint(point.x, point.y);
    if (rect) rebuild(rect);
    emit("dirty");
  }
}
function paint(x: number, y: number) {
  if (!refinement || !base || (props.tool !== "erase" && props.tool !== "restore")) return;
  return refinement.paint(x, y, props.brush / 2, props.strength / 100, props.tool);
}
function move(event: PointerEvent) {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (props.tool === "pan") {
    viewport.value!.scrollLeft = pointer.scrollLeft - (event.clientX - pointer.x);
    viewport.value!.scrollTop = pointer.scrollTop - (event.clientY - pointer.y);
    return;
  }
  if (props.tool === "layout") {
    const bounds = display.value!.getBoundingClientRect();
    emit(
      "offset",
      Math.max(-1, Math.min(1, pointer.offsetX + (event.clientX - pointer.x) / bounds.width)),
      Math.max(-1, Math.min(1, pointer.offsetY + (event.clientY - pointer.y) / bounds.height))
    );
    return;
  }
  const point = coordinates(event),
    distance = Math.hypot(point.x - pointer.lastX, point.y - pointer.lastY),
    count = Math.max(1, Math.ceil(distance / Math.max(1, props.brush / 6)));
  let dirtyRect: { left: number; top: number; width: number; height: number } | undefined;
  for (let n = 1; n <= count; n++) {
    const rect = paint(
      pointer.lastX + ((point.x - pointer.lastX) * n) / count,
      pointer.lastY + ((point.y - pointer.lastY) * n) / count
    );
    if (rect) {
      if (!dirtyRect) dirtyRect = rect;
      else {
        const left = Math.min(dirtyRect.left, rect.left),
          top = Math.min(dirtyRect.top, rect.top);
        dirtyRect = {
          left,
          top,
          width: Math.max(dirtyRect.left + dirtyRect.width, rect.left + rect.width) - left,
          height: Math.max(dirtyRect.top + dirtyRect.height, rect.top + rect.height) - top
        };
      }
    }
  }
  if (dirtyRect) {
    rebuild(dirtyRect);
    emit("dirty");
  }
  pointer.lastX = point.x;
  pointer.lastY = point.y;
}
function stop() {
  if (!pointer) return;
  pointer = undefined;
  refinement?.end();
  if (refinement) emit("history", refinement.canUndo, refinement.canRedo);
}
function undo() {
  stop();
  refinement?.undo();
  rebuild();
  emit("dirty");
}
function redo() {
  stop();
  refinement?.redo();
  rebuild();
  emit("dirty");
}
function resetRefinement() {
  stop();
  if (!base) return;
  refinement = createRefinement(base.width, base.height);
  rebuild();
  emit("dirty");
}
async function masks() {
  stop();
  if (!base || !refinement) throw new Error("编辑素材未就绪");
  const width = base.width,
    height = base.height;
  return Promise.all(
    [refinement.erase, refinement.restore].map((weights) => {
      const value = canvas(width, height),
        context = value.getContext("2d")!,
        data = context.createImageData(width, height);
      for (let p = 0; p < weights.length; p++) {
        const i = p * 4;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = weights[p];
        data.data[i + 3] = 255;
      }
      context.putImageData(data, 0, 0);
      return new Promise<Blob>((resolve, reject) =>
        value.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("精修蒙版生成失败"))), "image/png")
      );
    })
  );
}
watch(() => props.source, loadSource, { immediate: true });
watch(() => [props.recipe, props.subjectView], render, { deep: true });
watch(
  () => props.backgroundUrl,
  async (url) => {
    const token = ++backgroundGeneration;
    try {
      const value = url ? await loadImage(url) : undefined;
      if (alive && token === backgroundGeneration) {
        background = value;
        render();
      }
    } catch {
      if (alive && token === backgroundGeneration) emit("error", "背景图读取失败");
    }
  },
  { immediate: true }
);
onBeforeUnmount(() => {
  alive = false;
  generation++;
  backgroundGeneration++;
  for (const image of images) {
    image.onload = null;
    image.onerror = null;
    image.src = "";
  }
  images.clear();
  if (foreground) {
    foreground.width = 0;
    foreground.height = 0;
  }
  base = undefined;
  original = undefined;
  pixels = undefined;
  refinement = undefined;
});
defineExpose({ undo, redo, masks, resetRefinement });
</script>

<style scoped>
.product-viewport {
  min-width: 0;
  height: 560px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background-color: #fff;
  background-image: conic-gradient(#e9edf4 25%, transparent 0 50%, #e9edf4 0 75%, transparent 0);
  background-size: 20px 20px;
}
.product-viewport[style*="background:"] {
  background-image: none;
}
.product-canvas-wrap {
  min-width: 100%;
  min-height: 100%;
  width: max-content;
  display: flex;
  align-items: safe center;
  justify-content: safe center;
}
canvas {
  display: block;
  max-width: none;
  flex: none;
  touch-action: none;
}
@media (max-width: 760px) {
  .product-viewport {
    height: 400px;
  }
}
</style>
