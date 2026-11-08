<template>
  <ToolLayout>
    <section class="uuid-page v2-tool-page">
      <ToolPageHeader
        title="UUID 生成"
        kicker="IDENTITY / UUID"
        description="生成符合 RFC 9562 的随机 UUID v4，支持批量复制和下载。"
      />
      <div class="generator-workspace">
        <section class="generator-panel generator-settings">
          <h3 class="module-section-title">生成设置</h3>
          <div class="toolbar" role="group" aria-label="UUID 生成选项">
            <div class="option">
              <label for="uuid-count">生成数量</label
              ><n-input-number
                v-model:value="count"
                class="quantity"
                :disabled="busy"
                :step="1"
                :status="validCount ? undefined : 'error'"
                :input-props="{
                  id: 'uuid-count',
                  'aria-label': '生成数量',
                  inputmode: 'numeric'
                }"
              />
            </div>
            <div class="option">
              <span id="uuid-case-label">大小写</span
              ><n-select
                v-model:value="letterCase"
                class="case-select"
                aria-labelledby="uuid-case-label"
                :options="[
                  { label: '小写', value: 'lower' },
                  { label: '大写', value: 'upper' }
                ]"
              />
            </div>
            <n-checkbox v-model:checked="hyphens">保留连字符</n-checkbox>
            <div class="option">
              <span id="uuid-layout-label">输出格式</span
              ><n-select
                v-model:value="layout"
                class="layout-select"
                aria-labelledby="uuid-layout-label"
                :options="[
                  { label: '每行一条', value: 'lines' },
                  { label: '逗号分隔', value: 'comma' },
                  { label: 'JSON 数组', value: 'json' }
                ]"
              />
            </div>
            <n-button type="primary" :disabled="!canGenerate" :loading="busy" @click="generate">生成 UUID</n-button>
            <n-button v-if="busy" @click="stop">停止</n-button>
            <n-button :disabled="!values.length && !busy && !error && !notice" @click="clear">清空</n-button>
          </div>
          <p class="hint">数量为 1～10,000 的整数。调整大小写、连字符和输出格式只改变展示，UUID 不会重新生成。</p>
        </section>
        <section class="generator-panel generator-results">
          <p v-if="!validCount" class="validation" role="alert">请输入 1～10,000 的整数数量</p>
          <n-alert v-if="error" type="error" class="feedback">{{ error }}</n-alert>
          <n-alert v-if="notice" type="info" class="feedback">{{ notice }}</n-alert>
          <div class="result-heading">
            <label for="uuid-output">生成结果</label>
            <div class="developer-export-actions">
              <n-button :disabled="!canExport" @click="copy">复制结果</n-button>
              <n-button :disabled="!canExport" @click="download">下载结果</n-button>
            </div>
            <span role="status">{{
              busy
                ? `正在生成：${completed.toLocaleString()} / ${target.toLocaleString()}`
                : values.length
                  ? `已生成 ${values.length.toLocaleString()} 条`
                  : "设置数量后点击生成 UUID"
            }}</span>
            <span v-if="!busy && values.length && validCount && count !== values.length" class="hint"
              >下次生成 {{ count?.toLocaleString() }} 条</span
            >
          </div>
          <n-progress
            v-if="busy"
            type="line"
            :percentage="Math.floor((completed / target) * 100)"
            :show-indicator="false"
            aria-label="UUID 生成进度"
          />
          <textarea
            id="uuid-output"
            :value="output"
            readonly
            spellcheck="false"
            placeholder="生成的 UUID 将显示在这里"
          />
          <div class="result-actions">
            <span class="hint">结果只保存在当前页面，清空、刷新或离开后释放。</span>
          </div>
        </section>
      </div>
    </section>
  </ToolLayout>
</template>
<script setup lang="ts">
import { onScopeDispose } from "vue";
import { NAlert, NButton, NCheckbox, NInputNumber, NProgress, NSelect, useMessage } from "naive-ui";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { copyTextToClipboard } from "../../shared/utils/clipboard";
import { useUuidGenerator } from "./useUuidGenerator";
const {
  count,
  letterCase,
  hyphens,
  layout,
  values,
  busy,
  completed,
  target,
  error,
  notice,
  validCount,
  canGenerate,
  canExport,
  output,
  generate,
  stop,
  clear
} = useUuidGenerator();
const message = useMessage();
async function copy() {
  if (!canExport.value) return;
  try {
    await copyTextToClipboard(output.value);
    message.success("已复制生成结果");
  } catch {
    message.error("复制失败，请选择结果文本后手动复制");
  }
}
let downloadUrl: string | undefined, downloadTimer: ReturnType<typeof setTimeout> | undefined;
function releaseDownload() {
  clearTimeout(downloadTimer);
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
}
function download() {
  if (!canExport.value) return;
  releaseDownload();
  const json = layout.value === "json";
  downloadUrl = URL.createObjectURL(
    new Blob([output.value], { type: json ? "application/json;charset=utf-8" : "text/plain;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = json ? "uuids.json" : "uuids.txt";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    downloadTimer = setTimeout(releaseDownload, 1000);
  }
}
onScopeDispose(releaseDownload);
</script>
<style scoped>
.uuid-page {
  grid-column: 1 / -1;
  display: grid;
  gap: 20px;
  min-width: 0;
}
.generator-panel {
  box-shadow: var(--shadow-card);
  min-width: 0;
  padding: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.toolbar,
.option,
.result-heading,
.result-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.toolbar {
  gap: 16px;
}
.option {
  max-width: 100%;
}
.option > label,
.option > span,
.result-heading > label {
  font-weight: 600;
}
.quantity {
  width: 140px;
  max-width: 100%;
}
.case-select {
  width: 110px;
  max-width: 100%;
}
.layout-select {
  width: 150px;
  max-width: 100%;
}
.hint {
  color: var(--text-secondary, var(--color-text-secondary));
  font-size: 12px;
  line-height: 1.7;
}
.validation {
  color: var(--color-error);
  font-size: 13px;
}
.feedback {
  margin: 12px 0;
}
.result-heading {
  margin: 20px 0 12px;
}
.result-heading > span {
  font-size: 13px;
}
textarea {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: clamp(260px, 40vh, 480px);
  min-height: 260px;
  max-height: 640px;
  margin: 12px 0;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-subtle);
  color: var(--color-text);
  resize: vertical;
  font:
    14px/1.65 Consolas,
    "SFMono-Regular",
    monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow-x: hidden;
  overflow-y: auto;
}
textarea:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 1px;
}
.result-actions .hint {
  margin-right: auto;
}
@container tool-content (max-width: 480px) {
  .generator-panel {
    padding: 14px;
  }
  .toolbar {
    gap: 12px;
  }
  textarea {
    height: 42vh;
  }
}
</style>

<style src="../../shared/ui/tool/DeveloperWorkspace.css"></style>
