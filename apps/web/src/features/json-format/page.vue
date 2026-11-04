<template>
  <ToolLayout
    ><section class="json-format-page">
      <ToolPageHeader
        title="JSON 格式化"
        kicker="JSON / DATA"
        description="校验、格式化和压缩 JSON，保留数字精度与原始字段顺序。"
      >
        <template #actions><span class="local-badge">仅在本地处理</span></template>
      </ToolPageHeader>
      <section class="json-panel" @dragover.prevent @drop.prevent="drop">
        <div class="toolbar" role="group" aria-label="JSON 处理操作">
          <n-button @click="fileInput?.click()">导入文件</n-button>
          <input ref="fileInput" type="file" hidden accept=".json,.txt" @change="chooseFile" />
          <label class="indent-control"
            >缩进
            <n-select
              v-model:value="indent"
              aria-label="JSON 缩进"
              :options="[
                { label: '2 空格', value: '2' },
                { label: '4 空格', value: '4' },
                { label: 'Tab', value: 'tab' }
              ]"
            />
          </label>
          <n-button :type="mode === 'format' ? 'primary' : 'default'" :disabled="empty" @click="run('format')"
            >格式化</n-button
          >
          <n-button :type="mode === 'minify' ? 'primary' : 'default'" :disabled="empty" @click="run('minify')"
            >压缩</n-button
          >
          <n-button v-if="busy" @click="cancel">停止处理</n-button>
          <n-checkbox v-model:checked="automatic">自动处理小文本</n-checkbox>
          <n-button class="clear" :disabled="empty && !result && !notice" @click="clear">清空</n-button>
        </div>
        <p class="privacy">支持拖入 JSON / TXT，最大 5 MiB。内容不上传、不保存历史；离开或刷新页面后清除。</p>
        <n-alert v-if="notice" type="warning" closable @close="notice = ''">{{ notice }}</n-alert>
        <n-alert v-if="error" :type="error.code === 'syntax' ? 'error' : 'warning'" class="status">
          {{ error.message
          }}<template v-if="error.code === 'syntax'">
            · 第 {{ error.line }} 行，第 {{ error.column }} 列
            <n-button text type="error" @click="locateError">定位错误</n-button>
          </template>
        </n-alert>
        <p v-else class="status" role="status">
          {{
            busy
              ? "正在处理…"
              : empty
                ? "请输入 JSON，或导入一个文件"
                : stale
                  ? "输入或选项已变化，请重新处理"
                  : result
                    ? "JSON 校验通过"
                    : "等待处理"
          }}
        </p>
        <p v-if="sourceBytes > JSON_AUTO_BYTES" class="privacy">当前内容较大，请点击“格式化”或“压缩”手动处理。</p>
        <div class="editors">
          <section class="editor-pane">
            <label for="json-source">JSON 输入</label>
            <textarea
              id="json-source"
              ref="sourceInput"
              v-model="source"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              placeholder='例如：{"name":"商品","id":9007199254740993}'
              @paste="paste"
            />
            <small>{{ sourceChars }} 字符 · {{ formatBytesAdaptive(sourceBytes) }}</small>
          </section>
          <section class="editor-pane">
            <div class="output-heading">
              <label for="json-output">输出</label
              ><span v-if="stale || (error && result)" class="stale">旧结果，已暂停导出</span>
            </div>
            <textarea
              id="json-output"
              :value="result?.text ?? ''"
              readonly
              spellcheck="false"
              placeholder="处理结果将显示在这里"
              :aria-label="stale ? 'JSON 输出（已过期）' : 'JSON 输出'"
            />
            <div class="output-actions">
              <small>{{
                result ? `${result.outputChars} 字符 · ${formatBytesAdaptive(result.outputBytes)}` : "暂无结果"
              }}</small>
              <n-button size="small" :disabled="!canExport" @click="copy">复制结果</n-button>
              <n-button size="small" :disabled="!canExport" @click="download">下载 JSON</n-button>
            </div>
          </section>
        </div>
        <n-alert v-if="result && !stale && result.warningCount" type="warning">
          <p v-for="warning in result.warnings" :key="warning.offset">
            第 {{ warning.line }} 行，第 {{ warning.column }} 列：{{ warning.message }}
          </p>
          <p v-if="result.warningCount > result.warnings.length">
            共 {{ result.warningCount }} 条提示，仅显示前 {{ result.warnings.length }} 条。
          </p>
        </n-alert>
      </section>
    </section></ToolLayout
  >
</template>
<script setup lang="ts">
import { onScopeDispose, ref } from "vue";
import { NAlert, NButton, NCheckbox, NSelect, useMessage } from "naive-ui";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { copyTextToClipboard } from "../../shared/utils/clipboard";
import { formatBytesAdaptive } from "../../shared/utils/format-bytes";
import { JSON_AUTO_BYTES, JSON_LIMITS } from "./processor";
import { useJsonFormatter } from "./useJsonFormatter";
const {
  source,
  indent,
  mode,
  automatic,
  result,
  error,
  notice,
  busy,
  fileName,
  sourceBytes,
  sourceChars,
  empty,
  stale,
  canExport,
  run,
  cancel,
  clear,
  importFile
} = useJsonFormatter();
const sourceInput = ref<HTMLTextAreaElement>(),
  fileInput = ref<HTMLInputElement>(),
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
    notice.value = "每次请导入一个 JSON 或 TXT 文件";
    return;
  }
  void importFile(event.dataTransfer.files[0]);
}
function paste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text/plain"),
    input = sourceInput.value;
  if (text === undefined || !input) return;
  const next = source.value.slice(0, input.selectionStart) + text + source.value.slice(input.selectionEnd);
  if (next.length > JSON_LIMITS.inputBytes || new TextEncoder().encode(next).byteLength > JSON_LIMITS.inputBytes) {
    event.preventDefault();
    notice.value = "粘贴后将超过 5 MiB，已保留当前输入";
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
onScopeDispose(releaseDownload);
function download() {
  if (!canExport.value || !result.value) return;
  releaseDownload();
  const url = URL.createObjectURL(new Blob([result.value.text], { type: "application/json;charset=utf-8" }));
  downloadUrl = url;
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.value;
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
.json-format-page {
  grid-column: 1 / -1;
  min-width: 0;
  display: grid;
  gap: 20px;
}
.json-panel {
  min-width: 0;
  padding: 20px;
  background: var(--card-color, #fff);
  border: 1px solid var(--border-color, #dce4f1);
  border-radius: 12px;
}
.toolbar,
.indent-control,
.output-actions,
.output-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.indent-control {
  white-space: nowrap;
}
.indent-control .n-select {
  width: 120px;
}
.clear {
  margin-left: auto;
}
.privacy,
small {
  color: var(--text-secondary, #64748b);
  font-size: 12px;
}
.status {
  margin: 12px 0;
  min-height: 24px;
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
.editor-pane label {
  font-weight: 600;
}
.output-heading {
  min-height: 22px;
  justify-content: space-between;
}
.editor-pane > label {
  min-height: 22px;
}
textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 420px;
  height: 55vh;
  resize: vertical;
  padding: 14px;
  color: #172033;
  background: #fafbfd;
  border: 1px solid #dce4f1;
  border-radius: 8px;
  font:
    14px/1.65 Consolas,
    "SFMono-Regular",
    monospace;
  tab-size: 4;
  overflow: auto;
  white-space: pre;
}
textarea:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}
textarea[readonly] {
  background: #f5f7fb;
}
.output-actions small {
  margin-right: auto;
}
.local-badge {
  padding: 6px 10px;
  color: #0f766e;
  background: #d9faf2;
  border-radius: 12px;
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
  .json-panel {
    padding: 14px;
  }
  .toolbar {
    gap: 8px;
  }
  .clear {
    margin-left: 0;
  }
}
</style>
