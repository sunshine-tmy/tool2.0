<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <section class="mask-editor">
    <div class="mask-toolbar">
      <n-button-group>
        <n-button size="small" :type="mode === 'paint' ? 'primary' : 'default'" @click="mode = 'paint'">
          <template #icon><Paintbrush :size="15" /></template>
          涂抹
        </n-button>
        <n-button size="small" :type="mode === 'erase' ? 'primary' : 'default'" @click="mode = 'erase'">
          <template #icon><Eraser :size="15" /></template>
          擦除
        </n-button>
      </n-button-group>
      <label class="mask-range">
        <span>画笔 {{ brushSize }}px</span>
        <n-slider v-model:value="brushSize" :min="8" :max="240" :step="2" aria-label="画笔大小" />
      </label>
      <n-button size="small" secondary aria-label="撤销蒙版操作" :disabled="historyIndex <= 0" @click="undo">
        <template #icon><Undo2 :size="15" /></template>
      </n-button>
      <n-button
        size="small"
        secondary
        aria-label="重做蒙版操作"
        :disabled="historyIndex >= history.length - 1"
        @click="redo"
      >
        <template #icon><Redo2 :size="15" /></template>
      </n-button>
      <n-button size="small" secondary @click="clearMask">清空蒙版</n-button>
      <label class="mask-range zoom-control">
        <span>缩放 {{ Math.round(zoom * 100) }}%</span>
        <n-slider v-model:value="zoom" :min="0.5" :max="2.5" :step="0.1" aria-label="画布缩放" />
      </label>
    </div>

    <div ref="viewport" class="mask-viewport">
      <div class="mask-canvas-stack" :style="{ width: `${zoom * 100}%` }">
        <img :src="imageUrl" alt="待处理图片" decoding="async" @load="initialize" />
        <canvas
          ref="maskCanvas"
          class="mask-layer"
          aria-label="水印蒙版绘制区域"
          role="img"
          @pointerdown="startStroke"
          @pointermove="continueStroke"
          @pointerup="endStroke"
          @pointerenter="updateBrushCursor"
          @pointercancel="cancelStroke"
          @pointerleave="leaveCanvas"
        />
        <span
          v-show="brushCursor.visible"
          class="mask-brush-cursor"
          :class="{ 'is-erase': mode === 'erase' }"
          :style="{
            left: `${brushCursor.x}px`,
            top: `${brushCursor.y}px`,
            width: `${brushSize * brushCursor.scale}px`,
            height: `${brushSize * brushCursor.scale}px`
          }"
          aria-hidden="true"
        />
      </div>
    </div>
    <p class="mask-help">红色区域会被 AI 修复。OCR 框选只是建议，请检查后再开始处理。</p>
  </section>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref } from "vue";
import { NButton, NButtonGroup, NSlider } from "naive-ui";
import { Eraser, Paintbrush, Redo2, Undo2 } from "lucide-vue-next";
import type { WatermarkSuggestion } from "@toolbox/shared";

defineProps<{ imageUrl: string }>();
const emit = defineEmits<{ ready: [dimensions: { width: number; height: number }] }>();

const maskCanvas = ref<HTMLCanvasElement>();
const viewport = ref<HTMLElement>();
const mode = ref<"paint" | "erase">("paint");
const brushSize = ref(64);
const zoom = ref(1);
const history = ref<ImageData[]>([]);
const historyIndex = ref(-1);
const brushCursor = reactive({ visible: false, x: 0, y: 0, scale: 1 });
let drawing = false;
let lastPoint: { x: number; y: number } | null = null;

async function initialize(event: Event) {
  await nextTick();
  const image = event.target as HTMLImageElement;
  const canvas = maskCanvas.value;
  if (!canvas) return;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  history.value = [];
  historyIndex.value = -1;
  saveHistory();
  emit("ready", { width: canvas.width, height: canvas.height });
}

function pointFromEvent(event: PointerEvent) {
  const canvas = maskCanvas.value!;
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function updateBrushCursor(event: PointerEvent) {
  const canvas = maskCanvas.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  brushCursor.visible = event.pointerType !== "touch";
  brushCursor.x = event.clientX - rect.left;
  brushCursor.y = event.clientY - rect.top;
  brushCursor.scale = rect.width / canvas.width;
}

function startStroke(event: PointerEvent) {
  if (!maskCanvas.value) return;
  updateBrushCursor(event);
  drawing = true;
  maskCanvas.value.setPointerCapture(event.pointerId);
  lastPoint = pointFromEvent(event);
  drawLine(lastPoint, lastPoint);
}

function continueStroke(event: PointerEvent) {
  updateBrushCursor(event);
  if (!drawing || !lastPoint) return;
  const point = pointFromEvent(event);
  drawLine(lastPoint, point);
  lastPoint = point;
}

function endStroke() {
  if (!drawing) return;
  drawing = false;
  lastPoint = null;
  saveHistory();
}

function cancelStroke() {
  brushCursor.visible = false;
  endStroke();
}

function leaveCanvas() {
  brushCursor.visible = false;
  endStroke();
}

function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
  const context = maskCanvas.value?.getContext("2d");
  if (!context) return;
  context.save();
  context.globalCompositeOperation = mode.value === "paint" ? "source-over" : "destination-out";
  context.strokeStyle = "rgba(239, 68, 68, 0.82)";
  context.fillStyle = "rgba(239, 68, 68, 0.82)";
  context.lineWidth = brushSize.value;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
}

function applySuggestions(suggestions: WatermarkSuggestion[]) {
  const canvas = maskCanvas.value;
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  context.save();
  context.fillStyle = "rgba(239, 68, 68, 0.82)";
  for (const suggestion of suggestions) {
    if (suggestion.polygon.length < 3) continue;
    context.beginPath();
    suggestion.polygon.forEach((point, index) => {
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fill();
  }
  context.restore();
  saveHistory();
}

function clearMask() {
  const canvas = maskCanvas.value;
  canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  saveHistory();
}

function saveHistory() {
  const canvas = maskCanvas.value;
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  const snapshotBytes = canvas.width * canvas.height * 4;
  const historyBudgetBytes = 128 * 1024 * 1024;
  if (snapshotBytes > historyBudgetBytes) {
    history.value = [];
    historyIndex.value = -1;
    return;
  }
  const maxSnapshots = Math.max(1, Math.min(20, Math.floor(historyBudgetBytes / snapshotBytes)));
  const next = history.value.slice(0, historyIndex.value + 1);
  next.push(context.getImageData(0, 0, canvas.width, canvas.height));
  history.value = next.slice(-maxSnapshots);
  historyIndex.value = history.value.length - 1;
}

function restoreHistory(index: number) {
  const canvas = maskCanvas.value;
  const context = canvas?.getContext("2d");
  const snapshot = history.value[index];
  if (!canvas || !context || !snapshot) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.putImageData(snapshot, 0, 0);
  historyIndex.value = index;
}

function undo() {
  if (historyIndex.value > 0) restoreHistory(historyIndex.value - 1);
}

function redo() {
  if (historyIndex.value < history.value.length - 1) restoreHistory(historyIndex.value + 1);
}

async function toMaskBlob() {
  const source = maskCanvas.value;
  if (!source) throw new Error("蒙版编辑器尚未准备好");
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext("2d")!;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, output.width, output.height);
  const sourceContext = source.getContext("2d")!;
  const data = sourceContext.getImageData(0, 0, source.width, source.height);
  const mask = context.createImageData(source.width, source.height);
  let marked = false;
  for (let index = 0; index < data.data.length; index += 4) {
    const value = data.data[index + 3] > 0 ? 255 : 0;
    if (value) marked = true;
    mask.data[index] = value;
    mask.data[index + 1] = value;
    mask.data[index + 2] = value;
    mask.data[index + 3] = 255;
  }
  if (!marked) throw new Error("请先涂抹或选择需要去除的水印区域");
  context.putImageData(mask, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    output.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("无法生成蒙版"))), "image/png")
  );
}

defineExpose({ applySuggestions, toMaskBlob, clearMask });
</script>
