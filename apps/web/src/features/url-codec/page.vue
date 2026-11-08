<template>
  <ToolLayout>
    <section class="url-codec-page v2-tool-page">
      <ToolPageHeader
        title="URL 编解码"
        kicker="ENCODING / URL"
        description="编解码 URL 参数、路径片段和表单字段，保留 UTF-8 文本。"
      >
        <template #actions><span class="local-badge">仅在本地处理</span></template>
      </ToolPageHeader>
      <section class="developer-workspace codec-panel">
        <section class="developer-settings">
          <h3 class="module-section-title">输入与设置</h3>
          <div class="toolbar" role="group" aria-label="URL 处理选项">
            <n-radio-group v-model:value="direction" aria-label="编解码方向">
              <n-radio-button value="encode">编码</n-radio-button><n-radio-button value="decode">解码</n-radio-button>
            </n-radio-group>
            <n-select v-model:value="mode" class="mode-select" aria-label="URL 处理模式" :options="modeOptions" />
            <n-button type="primary" :disabled="!hasInput" @click="run">{{
              direction === "encode" ? "开始编码" : "开始解码"
            }}</n-button>
            <n-button v-if="busy" @click="cancel">停止处理</n-button>
            <n-button class="clear" :disabled="!hasInput && !result && !notice" @click="clear">清空</n-button>
          </div>
          <n-checkbox v-model:checked="automatic">自动处理小文本</n-checkbox>
          <p class="mode-help">{{ modeHelp[mode] }}</p>
        </section>
        <div class="editors">
          <section class="editor-pane">
            <label for="url-codec-source">URL 输入</label>
            <textarea
              id="url-codec-source"
              ref="sourceInput"
              v-model="source"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              :placeholder="direction === 'encode' ? '请输入需要编码的文本或 URL' : '请输入需要解码的文本或 URL'"
              @paste="paste"
            />
            <small>{{ metrics.characters }} 字符 · {{ formatBytesAdaptive(metrics.bytes) }}</small>
          </section>
          <section class="editor-pane">
            <div class="output-heading">
              <label for="url-codec-output">输出</label
              ><span v-if="stale || (error && result)" class="stale">旧结果，已暂停导出</span>
              <div class="developer-export-actions">
                <n-button size="small" :disabled="!canExport" @click="copy">复制结果</n-button>
                <n-button size="small" :disabled="!canExport" @click="download">下载 TXT</n-button>
              </div>
            </div>
            <textarea
              id="url-codec-output"
              :value="result?.text ?? ''"
              readonly
              spellcheck="false"
              :aria-label="stale ? 'URL 输出（已过期）' : 'URL 输出'"
              placeholder="处理结果将显示在这里"
            />
            <div class="output-actions">
              <small>{{
                result ? `${result.outputChars} 字符 · ${formatBytesAdaptive(result.outputBytes)}` : "暂无结果"
              }}</small>
            </div>
          </section>
        </div>
        <section class="developer-feedback" aria-label="处理状态">
          <n-alert v-if="notice" type="warning" closable @close="notice = ''">{{ notice }}</n-alert>
          <n-alert v-if="error" :type="['limit', 'internal'].includes(error.code) ? 'warning' : 'error'" class="status">
            {{ error.message
            }}<template v-if="!['limit', 'internal'].includes(error.code)">
              · 第 {{ error.line }} 行，第 {{ error.column }} 列
              <n-button text type="error" @click="locateError">定位错误</n-button>
            </template>
          </n-alert>
          <p v-else class="status" role="status">
            {{
              busy
                ? "正在处理…"
                : !hasInput
                  ? "请输入内容"
                  : stale
                    ? "输入或选项已变化，请重新处理"
                    : result
                      ? "处理完成"
                      : "等待处理"
            }}
          </p>
        </section>
        <details class="module-help">
          <summary>使用说明与处理限制</summary>
          <p class="hint">内容不上传、不保存历史，离开或刷新页面后清除。每次只处理一层，不自动访问地址。</p>
          <p class="hint">
            输入最大 1 MiB，输出最大 3 MiB；超过 200 KiB 的文本请手动处理。保留空格和换行，不自动去除前后空白。
          </p>
        </details>
      </section>
    </section>
  </ToolLayout>
</template>
<script setup lang="ts">
import { onScopeDispose, ref } from "vue";
import { NAlert, NButton, NCheckbox, NRadioButton, NRadioGroup, NSelect, useMessage } from "naive-ui";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { copyTextToClipboard } from "../../shared/utils/clipboard";
import { formatBytesAdaptive } from "../../shared/utils/format-bytes";
import { measureUrlText, URL_CODEC_LIMITS, type UrlSettings } from "./processor";
import { useUrlCodec } from "./useUrlCodec";
const {
  source,
  direction,
  mode,
  automatic,
  result,
  error,
  notice,
  busy,
  metrics,
  hasInput,
  stale,
  canExport,
  run,
  cancel,
  clear
} = useUrlCodec();
const sourceInput = ref<HTMLTextAreaElement>(),
  message = useMessage();
const modeOptions = [
  { label: "URL 组件（默认）", value: "component" },
  { label: "完整 URL", value: "uri" },
  { label: "表单字段值", value: "form" }
];
const modeHelp: Record<UrlSettings["mode"], string> = {
  component: "用于单个参数值或路径片段；空格编码为 %20，解码时普通 + 保持不变。",
  uri: "保留 ://、/、?、&、=、# 等地址结构；解码时 %2F、%3F 等结构字符仍保留转义。已有的 % 会再次编码。",
  form: "只处理一个表单字段的值，不拆解整段查询参数；空格与 + 互转，真正的加号编码为 %2B。"
};
function locateError() {
  if (!error.value || !sourceInput.value) return;
  sourceInput.value.focus();
  sourceInput.value.setSelectionRange(error.value.offset, Math.min(source.value.length, error.value.offset + 1));
}
function paste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text/plain"),
    input = sourceInput.value;
  if (text === undefined || !input) return;
  const next = source.value.slice(0, input.selectionStart) + text + source.value.slice(input.selectionEnd);
  if (next.length > URL_CODEC_LIMITS.inputBytes || measureUrlText(next).bytes > URL_CODEC_LIMITS.inputBytes) {
    event.preventDefault();
    notice.value = "粘贴后将超过 1 MiB，已保留当前输入";
  }
}
async function copy() {
  if (!canExport.value || !result.value) return;
  try {
    await copyTextToClipboard(result.value.text);
    message.success("已复制处理结果");
  } catch {
    message.error("复制失败，请选择输出文本后手动复制");
  }
}
let downloadUrl: string | undefined, downloadTimer: ReturnType<typeof setTimeout> | undefined;
function releaseDownload() {
  clearTimeout(downloadTimer);
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
}
function download() {
  if (!canExport.value || !result.value) return;
  releaseDownload();
  downloadUrl = URL.createObjectURL(new Blob([result.value.text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = result.value.direction === "encode" ? "url-encoded.txt" : "url-decoded.txt";
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
.url-codec-page {
  grid-column: 1 / -1;
  display: grid;
  gap: 20px;
  min-width: 0;
}
.codec-panel {
  box-shadow: var(--shadow-card);
  min-width: 0;
  padding: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.toolbar,
.output-heading,
.output-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.mode-select {
  width: 230px;
  max-width: 100%;
}
.clear {
  margin-left: auto;
}
.hint,
small,
.mode-help {
  color: var(--text-secondary, var(--color-text-secondary));
  font-size: 12px;
}
.mode-help {
  line-height: 1.7;
}
.status {
  min-height: 24px;
  margin: 12px 0;
}
.editors {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 16px 0;
}
.editor-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 10px;
}
.editor-pane > label,
.output-heading {
  min-height: 22px;
}
.editor-pane label {
  font-weight: 600;
}
.output-heading {
  justify-content: space-between;
}
textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 320px;
  height: clamp(320px, 40vh, 480px);
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
textarea[readonly] {
  background: var(--color-surface-subtle);
}
.output-actions small {
  margin-right: auto;
}
.local-badge {
  color: #0f766e;
  background: #d9faf2;
  border-radius: var(--radius-card);
  padding: 6px 10px;
  font-size: 12px;
}
.stale {
  color: #b45309;
  font-size: 12px;
}
@media (max-width: 900px) {
  .editors {
    grid-template-columns: minmax(0, 1fr);
  }
  textarea {
    min-height: 260px;
    height: 36vh;
  }
}
@media (max-width: 480px) {
  .codec-panel {
    padding: 14px;
  }
  .clear {
    margin-left: 0;
  }
  .toolbar {
    gap: 8px;
  }
}
</style>

<style src="../../shared/ui/tool/DeveloperWorkspace.css"></style>
