<template>
  <section class="product-editor" aria-label="商品图编辑器">
    <div class="product-editor-heading">
      <div>
        <h3>商品图编辑器</h3>
        <p>{{ dirty ? "有未保存的修改" : "保存会生成独立留档，不覆盖来源图片" }}</p>
      </div>
      <n-button :disabled="busy" @click="leave">返回图片处理</n-button>
    </div>
    <n-alert v-if="error" type="error" :bordered="false">{{ error }}</n-alert>
    <n-spin :show="loading">
      <div v-if="source" class="product-editor-grid">
        <div class="product-editor-stage">
          <div class="product-toolbar">
            <n-button size="small" :disabled="busy" @click="zoom = 1">适应画布</n-button>
            <div class="product-zoom-control">
              <span>缩放</span
              ><n-slider
                v-model:value="zoom"
                :min="0.5"
                :max="4"
                :step="0.25"
                :disabled="busy"
                aria-label="画布缩放"
              /><output>{{ Math.round(zoom * 100) }}%</output>
            </div>
            <div class="product-check-controls">
              <n-select
                v-model:value="checkColor"
                :options="checkOptions"
                :disabled="busy"
                aria-label="检查底色（不导出）"
              />
              <n-color-picker
                :value="checkColor || '#FFFFFF'"
                :show-alpha="false"
                :modes="['hex']"
                :disabled="busy"
                aria-label="自定义检查底色（不导出）"
                @update:value="setCheckColor"
              >
                <template #trigger="{ ref: triggerRef, onClick: openPicker }">
                  <button
                    :ref="triggerRef"
                    type="button"
                    class="product-check-swatch"
                    :disabled="busy"
                    aria-label="自定义检查底色（不导出）"
                    :title="`检查底色：${checkColor || '#FFFFFF'}（不导出）`"
                    @click="openPicker"
                  >
                    <span :style="{ backgroundColor: checkColor || '#FFFFFF' }" aria-hidden="true" />
                  </button>
                </template>
              </n-color-picker>
            </div>
          </div>
          <ProductImageCanvas
            :key="canvasVersion"
            ref="canvas"
            :source="source"
            :recipe="recipe"
            :background-url="backgroundUrl"
            :tool="tool"
            :subject-view="subjectView"
            :brush="brush"
            :strength="strength"
            :zoom="zoom"
            :check-color="checkColor"
            :disabled="busy"
            @ready="ready = true"
            @error="error = $event"
            @dirty="changed"
            @offset="setOffset"
            @history="setHistory"
          />
          <p class="product-hint">
            {{
              subjectView
                ? "精修视图：直接编辑原始前景；检查底色不会导出。切换“拖动商品”查看最终排版。"
                : "成品预览：拖动调整商品位置；最终文件按所选尺寸由后端渲染。"
            }}
          </p>
        </div>
        <aside class="product-settings">
          <fieldset :disabled="busy">
            <legend>抠图精修</legend>
            <div class="product-tools">
              <n-button size="small" :disabled="busy" @click="resetRefinement">重置精修</n-button>
              <n-button
                v-for="item in tools"
                :key="item.value"
                size="small"
                :type="tool === item.value ? 'primary' : 'default'"
                :disabled="busy || (item.value === 'restore' && !source.canRestore)"
                @click="setTool(item.value)"
                >{{ item.label }}</n-button
              >
            </div>
            <p v-if="!source.canRestore" class="product-hint">{{ source.reason }}</p>
            <label>笔刷大小（代理像素）<n-slider v-model:value="brush" :min="4" :max="240" :disabled="busy" /></label>
            <label>笔刷强度<n-slider v-model:value="strength" :min="5" :max="100" :disabled="busy" /></label>
            <div class="product-tools">
              <n-button size="small" :disabled="busy || !canUndo" @click="canvas?.undo()">撤销</n-button
              ><n-button size="small" :disabled="busy || !canRedo" @click="canvas?.redo()">重做</n-button>
            </div>
          </fieldset>
          <fieldset :disabled="busy">
            <legend>商品背景</legend>
            <n-select
              :value="recipe.background.kind"
              :options="backgroundOptions"
              :disabled="busy"
              aria-label="背景类型"
              @update:value="setBackground"
            />
            <n-color-picker
              v-if="recipe.background.kind === 'color'"
              :value="recipe.background.color"
              :show-alpha="false"
              :modes="['hex']"
              :disabled="busy"
              @update:value="setColor"
            />
            <div v-if="recipe.background.kind === 'image'" class="product-background-field">
              <span class="product-field-label">背景图片</span>
              <input
                ref="backgroundInput"
                hidden
                class="product-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :disabled="busy"
                aria-label="选择本机背景图"
                @change="selectBackground"
              />
              <button
                type="button"
                class="product-background-upload"
                :class="{ 'has-image': backgroundUrl, 'is-dragging': draggingBackground }"
                :disabled="busy"
                :aria-label="backgroundUrl ? '更换背景图片' : '上传背景图片'"
                @click="backgroundInput?.click()"
                @dragover.prevent="draggingBackground = !busy"
                @dragleave="draggingBackground = false"
                @drop.prevent="dropBackground"
              >
                <img
                  v-if="backgroundUrl"
                  :src="backgroundPreviewUrl"
                  alt="已选择的背景图片"
                  class="product-background-thumbnail"
                />
                <span v-else class="product-upload-icon"><ImagePlus :size="24" /></span>
                <span class="product-upload-copy"
                  ><strong :title="backgroundFile?.name">{{
                    backgroundFile?.name || (backgroundUrl ? "已保存的背景图片" : "上传背景图片")
                  }}</strong
                  ><small>{{
                    backgroundFile
                      ? `${(backgroundFile.size / 1024).toFixed(1)} KB · 点击更换`
                      : backgroundUrl
                        ? "点击更换，或拖入新的图片"
                        : "点击选择，或拖入一张图片"
                  }}</small></span
                >
                <Upload :size="16" class="product-upload-action" aria-hidden="true" />
              </button>
              <span class="product-upload-formats">JPG / PNG / WebP · 单张不超过 20 MiB</span>
            </div>
            <p v-if="recipe.background.kind === 'image'" class="product-hint">
              居中裁切铺满画布，透明区域使用白色填充，不拉伸。
            </p>
          </fieldset>
          <fieldset :disabled="busy">
            <legend>主图标准化</legend>
            <n-select
              :value="preset"
              :options="presets"
              :disabled="busy"
              aria-label="主图规格"
              @update:value="applyPreset"
            />
            <div class="product-dimensions">
              <n-input-number
                :value="recipe.canvas.width"
                :min="256"
                :max="4096"
                :precision="0"
                :disabled="busy"
                aria-label="画布宽度"
                @update:value="setDimension('width', $event)"
              /><span>×</span
              ><n-input-number
                :value="recipe.canvas.height"
                :min="256"
                :max="4096"
                :precision="0"
                :disabled="busy"
                aria-label="画布高度"
                @update:value="setDimension('height', $event)"
              />
            </div>
            <label
              >商品占比 {{ Math.round(recipe.layout.fill * 100) }}%<n-slider
                :value="Math.round(recipe.layout.fill * 100)"
                :min="50"
                :max="95"
                :disabled="busy"
                @update:value="
                  recipe.layout.fill = $event / 100;
                  changed();
                "
            /></label>
            <label
              >缩小商品<n-slider
                :value="recipe.layout.scale"
                :min="0.1"
                :max="1"
                :step="0.01"
                :disabled="busy"
                @update:value="
                  recipe.layout.scale = $event;
                  changed();
                "
            /></label>
            <n-select
              :value="recipe.layout.align"
              :options="alignOptions"
              :disabled="busy"
              aria-label="商品对齐"
              @update:value="
                recipe.layout.align = $event;
                changed();
              "
            />
            <n-button size="small" :disabled="busy" @click="resetLayout">恢复自动布局</n-button>
          </fieldset>
          <div v-if="task" class="product-task" role="status">
            <strong>{{ task.phase || (task.status === "pending" ? "等待保存" : task.status) }}</strong>
            <p v-if="task.error">{{ task.error }}</p>
            <n-button v-if="taskBusy" size="small" type="error" secondary :disabled="cancelRequested" @click="cancel">{{
              cancelRequested ? "等待当前渲染结束后取消" : "取消保存"
            }}</n-button>
          </div>
        </aside>
      </div>
    </n-spin>
    <div class="product-editor-footer">
      <n-button :disabled="busy || !source" @click="reset">重置编辑</n-button>
      <n-button type="primary" :loading="busy" :disabled="!ready || !source || busy" @click="save">保存并留档</n-button>
      <template v-if="savedTask?.results[0]"
        ><n-select v-model:value="downloadFormat" :options="formatOptions" aria-label="下载格式" /><n-button
          :disabled="busy"
          @click="download"
          >下载已保存结果</n-button
        ></template
      >
    </div>
  </section>
</template>

<script setup lang="ts">
import { NAlert, NButton, NColorPicker, NInputNumber, NSelect, NSlider, NSpin } from "naive-ui";
import { ImagePlus, Upload } from "lucide-vue-next";
import type { ImageAiTask } from "@toolbox/shared";
import ProductImageCanvas from "./ProductImageCanvas.vue";
import { tools, backgroundOptions, alignOptions, presets, formatOptions } from "./options";
import { useProductImageEditor } from "./useProductImageEditor";
const props = defineProps<{ taskId: string; resultId: string }>();
const emit = defineEmits<{ close: []; saved: [task: ImageAiTask] }>();
const {
  source,
  recipe,
  canvas,
  loading,
  ready,
  dirty,
  error,
  task,
  savedTask,
  taskBusy,
  busy,
  cancelRequested,
  canUndo,
  canRedo,
  canvasVersion,
  downloadFormat,
  tool,
  subjectView,
  brush,
  strength,
  zoom,
  checkColor,
  checkOptions,
  preset,
  setCheckColor,
  setOffset,
  setTool,
  setBackground,
  setColor,
  applyPreset,
  setDimension,
  resetLayout,
  backgroundInput,
  draggingBackground,
  backgroundUrl,
  backgroundFile,
  backgroundPreviewUrl,
  selectBackground,
  dropBackground,
  changed,
  setHistory,
  leave,
  reset,
  resetRefinement,
  save,
  cancel,
  download
} = useProductImageEditor(props, emit);
</script>

<style scoped>
.product-editor {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.product-editor-heading,
.product-editor-footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.product-editor-heading h3 {
  margin: 0;
}
.product-editor-heading p,
.product-hint {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.product-editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 18px;
}
.product-editor-stage,
.product-settings {
  min-width: 0;
}
.product-settings {
  display: grid;
  gap: 12px;
}
.product-toolbar,
.product-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.product-zoom-control {
  display: grid;
  grid-template-columns: auto minmax(90px, 1fr) 46px;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 200px;
  font-size: 12px;
}
.product-zoom-control span,
.product-zoom-control output {
  white-space: nowrap;
}
.product-zoom-control output {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}
.product-check-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.product-check-controls > :first-child {
  width: 170px;
  flex: 0 0 170px;
}
.product-check-controls > :last-child {
  width: 44px;
  min-width: 44px;
  max-width: 44px;
  flex: 0 0 44px;
}
.product-check-swatch {
  display: grid;
  place-items: center;
  width: 44px;
  height: 36px;
  padding: 6px;
  flex: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface, #fff);
  cursor: pointer;
}
.product-check-swatch span {
  display: block;
  width: 22px;
  height: 22px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
}
.product-check-swatch:hover:not(:disabled) {
  border-color: #2563eb;
}
.product-check-swatch:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.product-check-swatch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.product-background-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.product-field-label {
  font-size: 12px;
  font-weight: 500;
}
.product-file-input {
  display: none;
}
.product-background-upload {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  min-height: 96px;
  padding: 14px;
  border: 1px dashed #b8c9e8;
  border-radius: 10px;
  background: var(--color-surface, #fff);
  color: var(--color-text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background-color 0.15s,
    box-shadow 0.15s;
}
.product-background-upload:hover:not(:disabled),
.product-background-upload.is-dragging {
  border-color: #2563eb;
  background: #eff6ff;
}
.product-background-upload:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 3px;
}
.product-background-upload:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.product-upload-icon {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #edf4ff;
  color: #2563eb;
}
.product-background-thumbnail {
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  object-fit: cover;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
.product-upload-copy {
  display: grid;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.product-upload-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}
.product-upload-copy small,
.product-upload-formats {
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.5;
}
.product-upload-action {
  flex: none;
  color: #64748b;
}
fieldset {
  display: grid;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-subtle);
}
legend {
  font-weight: 600;
}
label {
  font-size: 12px;
}
.product-dimensions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.product-dimensions .n-input-number {
  min-width: 0;
  flex: 1;
}
.product-editor-footer {
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.product-editor-footer .n-select {
  width: 100px;
}
.product-task {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
}
@media (max-width: 1180px) {
  .product-editor-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 680px) {
  .product-zoom-control {
    order: 3;
    flex-basis: 100%;
  }
  .product-check-controls {
    margin-left: auto;
  }
}
</style>
