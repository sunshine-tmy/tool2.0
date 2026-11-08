<template>
  <ToolLayout
    ><section class="base64-page v2-tool-page">
      <ToolPageHeader
        title="Base64 编解码"
        kicker="ENCODING / BASE64"
        description="使用 UTF-8 编解码文本，支持文件与 URL 安全格式。"
      />
      <section class="developer-workspace codec-panel" @dragover.prevent @drop.prevent="drop">
        <section class="developer-settings">
          <h3 class="module-section-title">输入与设置</h3>
          <div class="toolbar" role="group" aria-label="Base64 处理选项">
            <n-radio-group v-model:value="direction" aria-label="编解码方向">
              <n-radio-button value="encode">编码</n-radio-button><n-radio-button value="decode">解码</n-radio-button>
            </n-radio-group>
            <n-select
              v-model:value="alphabet"
              class="alphabet"
              aria-label="Base64 类型"
              :options="[
                { label: '标准 Base64', value: 'standard' },
                { label: 'Base64URL（URL 安全）', value: 'url' }
              ]"
            />
            <n-button :loading="importing" @click="fileInput?.click()">导入文件</n-button>
            <input
              ref="fileInput"
              hidden
              type="file"
              :accept="direction === 'encode' ? undefined : '.txt,.b64,.base64'"
              @change="chooseFile"
            />
            <n-button type="primary" :disabled="!hasInput || importing" @click="run">{{
              direction === "encode" ? "开始编码" : "开始解码"
            }}</n-button>
            <n-button v-if="busy || importing" @click="cancel">停止处理</n-button>
            <n-button class="clear" :disabled="!hasInput && !result && !notice && !file && !importing" @click="clear"
              >清空</n-button
            >
          </div>
          <div class="secondary">
            <n-radio-group
              v-if="direction === 'encode'"
              v-model:value="inputKind"
              size="small"
              aria-label="编码输入类型"
            >
              <n-radio-button value="text">文本</n-radio-button><n-radio-button value="file">文件</n-radio-button>
            </n-radio-group>
            <n-checkbox v-if="direction === 'decode'" v-model:checked="ignoreWhitespace"
              >忽略输入中的空格与换行</n-checkbox
            >
            <n-checkbox v-model:checked="automatic" :disabled="activeFile">自动处理小文本</n-checkbox>
          </div>
        </section>
        <div class="editors">
          <section class="editor-pane">
            <label :for="activeFile ? undefined : 'base64-source'">{{
              direction === "decode" ? "Base64 输入" : "编码输入"
            }}</label>
            <div v-if="activeFile" class="file-input">
              <template v-if="file"
                ><strong>{{ file.name }}</strong
                ><span>{{ formatBytesAdaptive(file.size) }}</span
                ><n-button size="small" @click="removeFile">移除文件</n-button></template
              >
              <span v-else>点击“导入文件”或将一个文件拖入此处</span>
              <p>使用原始文件字节编码，不修改原文件。</p>
            </div>
            <textarea
              v-else
              id="base64-source"
              ref="sourceInput"
              v-model="source"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              :placeholder="direction === 'decode' ? '请输入 Base64 字符串' : '请输入需要编码的 UTF-8 文本'"
              @paste="paste"
            />
            <small
              >{{ activeFile ? "文件输入" : `${sourceChars} 字符` }} · {{ formatBytesAdaptive(sourceBytes) }}</small
            >
          </section>
          <section class="editor-pane">
            <div class="output-heading">
              <label :for="result?.kind === 'binary' ? undefined : 'base64-output'">输出</label
              ><span v-if="stale || (error && result)" class="stale">旧结果，已暂停导出</span>
              <div class="developer-export-actions">
                <n-button size="small" :disabled="!canCopy" @click="copy">复制结果</n-button>
                <n-button size="small" :disabled="!canExport" @click="download">下载结果</n-button>
              </div>
            </div>
            <div v-if="result?.kind === 'binary'" class="binary-output" role="status">
              <strong>二进制结果 · {{ formatBytesAdaptive(result.outputBytes) }}</strong>
              <p>内容不是有效的 UTF-8 文本。原始字节已保留，请下载文件。</p>
            </div>
            <textarea
              v-else
              id="base64-output"
              :value="result?.text ?? ''"
              readonly
              spellcheck="false"
              placeholder="处理结果将显示在这里"
              :aria-label="stale ? 'Base64 输出（已过期）' : 'Base64 输出'"
            />
            <div class="output-actions">
              <small>{{
                result
                  ? `${result.kind === "text" ? resultChars + " 字符 · " : ""}${formatBytesAdaptive(result.outputBytes)}`
                  : "暂无结果"
              }}</small>
            </div>
          </section>
        </div>
        <section class="developer-feedback" aria-label="处理状态">
          <n-alert v-if="notice" type="warning" closable @close="notice = ''">{{ notice }}</n-alert>
          <n-alert
            v-if="error"
            :type="error.code === 'limit' || error.code === 'internal' ? 'warning' : 'error'"
            class="status"
          >
            {{ error.message
            }}<template v-if="!activeFile && ['text', 'base64'].includes(error.code)">
              · 第 {{ error.line }} 行，第 {{ error.column }} 列
              <n-button text type="error" @click="locateError">定位错误</n-button>
            </template>
          </n-alert>
          <p v-else class="status" role="status">
            {{
              busy
                ? "正在处理…"
                : importing
                  ? "正在读取文件…"
                  : !hasInput
                    ? "请输入内容或导入文件"
                    : stale
                      ? "输入或选项已变化，请重新处理"
                      : result
                        ? result.kind === "binary"
                          ? "解码成功，结果为二进制数据，可下载文件"
                          : "处理完成"
                        : "等待处理"
            }}
          </p>
          <n-alert v-if="result && !stale && result.warnings.length" type="warning"
            ><p v-for="warning in result.warnings" :key="warning">
              {{ warning }}
            </p></n-alert
          >
        </section>
        <details class="module-help">
          <summary>使用说明与处理限制</summary>
          <p class="privacy">内容不上传、不保存历史，离开或刷新页面后清除。Base64 是编码，不提供加密保护。</p>
          <p class="privacy">
            {{
              direction === "encode"
                ? "编码输入最大 5 MiB，输出最多约 6.67 MiB。"
                : "解码输入最大 7 MiB，解码结果最大 5 MiB。"
            }}文件及超过 200 KiB 的文本请手动处理。
          </p>
        </details>
      </section>
    </section></ToolLayout
  >
</template>
<script setup lang="ts">
import { onScopeDispose, ref } from "vue";
import { NAlert, NButton, NCheckbox, NRadioButton, NRadioGroup, NSelect, useMessage } from "naive-ui";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { copyTextToClipboard } from "../../shared/utils/clipboard";
import { formatBytesAdaptive } from "../../shared/utils/format-bytes";
import { BASE64_LIMITS } from "./processor";
import { useBase64Codec } from "./useBase64Codec";
const {
  source,
  direction,
  alphabet,
  ignoreWhitespace,
  automatic,
  inputKind,
  file,
  result,
  error,
  notice,
  busy,
  importing,
  activeFile,
  hasInput,
  sourceBytes,
  sourceChars,
  resultChars,
  stale,
  canExport,
  canCopy,
  run,
  cancel,
  importFile,
  removeFile,
  clear,
  downloadName
} = useBase64Codec();
const fileInput = ref<HTMLInputElement>(),
  sourceInput = ref<HTMLTextAreaElement>(),
  message = useMessage();
function locateError() {
  if (!error.value || !sourceInput.value) return;
  sourceInput.value.focus();
  sourceInput.value.setSelectionRange(error.value.offset, Math.min(source.value.length, error.value.offset + 1));
}
function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files?.[0]) void importFile(input.files[0]);
  input.value = "";
}
function drop(event: DragEvent) {
  if (event.dataTransfer?.files.length !== 1) {
    notice.value = "每次请导入一个文件";
    return;
  }
  void importFile(event.dataTransfer.files[0]);
}
function paste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text/plain"),
    input = sourceInput.value;
  if (text === undefined || !input) return;
  const next = source.value.slice(0, input.selectionStart) + text + source.value.slice(input.selectionEnd);
  const limit = direction.value === "encode" ? BASE64_LIMITS.payloadBytes : BASE64_LIMITS.encodedBytes;
  if (next.length > limit || new TextEncoder().encode(next).byteLength > limit) {
    event.preventDefault();
    notice.value = `粘贴后将超过 ${direction.value === "encode" ? 5 : 7} MiB，已保留当前输入`;
  }
}
async function copy() {
  if (!canCopy.value || result.value?.kind !== "text") return;
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
onScopeDispose(releaseDownload);
function download() {
  if (!canExport.value || !result.value) return;
  releaseDownload();
  const value = result.value;
  downloadUrl = URL.createObjectURL(
    value.direction === "decode"
      ? new Blob([value.buffer], {
          type: value.kind === "text" ? "text/plain;charset=utf-8" : "application/octet-stream"
        })
      : new Blob([value.text], { type: "text/plain;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = downloadName();
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    downloadTimer = setTimeout(releaseDownload, 1000);
  }
}
</script>
<style scoped>
.base64-page {
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
.secondary,
.output-heading,
.output-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.alphabet {
  width: 230px;
  max-width: 100%;
}
.clear {
  margin-left: auto;
}
.secondary {
  margin-top: 12px;
  gap: 16px;
}
.privacy,
small {
  color: var(--text-secondary, var(--color-text-secondary));
  font-size: 12px;
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
textarea,
.file-input,
.binary-output {
  box-sizing: border-box;
  width: 100%;
  min-height: 320px;
  height: clamp(320px, 40vh, 480px);
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-subtle);
  color: var(--color-text);
}
textarea {
  display: block;
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
textarea[readonly],
.binary-output {
  background: var(--color-surface-subtle);
}
.file-input,
.binary-output {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 12px;
  overflow-wrap: anywhere;
}
.output-actions small {
  margin-right: auto;
}
.stale {
  color: #b45309;
  font-size: 12px;
}
@container tool-content (max-width: 900px) {
  .editors {
    grid-template-columns: minmax(0, 1fr);
  }
  textarea,
  .file-input,
  .binary-output {
    min-height: 260px;
    height: 36vh;
  }
}
@container tool-content (max-width: 480px) {
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
