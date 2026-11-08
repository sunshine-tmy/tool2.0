<template>
  <ToolLayout
    ><section class="conversion-page v2-tool-page">
      <ToolPageHeader
        title="音频格式转换"
        kicker="AUDIO CONVERTER"
        description="批量转为 MP3，成功结果长期保留，支持下载与加入音频素材库。"
      />
      <n-alert v-if="error" type="error" closable @close="error = ''">{{ error }}</n-alert>

      <section class="conversion-panel conversion-setup">
        <div class="conversion-setup-grid">
          <div class="conversion-upload-section">
            <h3 class="module-section-title">上传与转换设置</h3>
            <label
              class="conversion-drop file-upload-area"
              data-upload-area
              tabindex="0"
              role="button"
              :aria-disabled="busy"
              @keydown.enter="!busy && input?.click()"
              @keydown.space.prevent="!busy && input?.click()"
              @click="busy && $event.preventDefault()"
              @dragover.prevent
              @drop.prevent="!busy && choose(Array.from($event.dataTransfer?.files ?? []))"
              ><input
                ref="input"
                type="file"
                :disabled="busy"
                hidden
                multiple
                accept=".ogg,.flac,.mgg,.mflac"
                @change="selectFiles"
              /><UploadCloud :size="34" aria-hidden="true" /><strong>上传音频（最多 1000 条）</strong
              ><span>点击或拖入 OGG、FLAC、MGG、MFLAC</span></label
            ><n-alert type="info" class="module-advisory-note"
              >OGG（Vorbis/Opus）、FLAC 可直接转换。MGG/MFLAC 按实际加密版本识别；不含密钥的 musicex 文件需填写该文件的
              EKey，不读取账号或登录信息。</n-alert
            ><label class="module-setting conversion-bitrate"
              ><span>MP3 音质 / 码率</span
              ><n-select
                v-model:value="bitrate"
                aria-label="MP3 码率"
                :disabled="busy"
                :options="[
                  { value: 128, label: '128 kbps · 体积较小' },
                  { value: 192, label: '192 kbps · 均衡（推荐）' },
                  { value: 256, label: '256 kbps · 较高音质' },
                  { value: 320, label: '320 kbps · 体积较大' }
                ]"
            /></label>
            <div class="conversion-start">
              <n-button type="primary" :disabled="!remaining || busy" @click="start"
                >开始转换 {{ remaining }} 条</n-button
              ><n-button v-if="busy" @click="stopQueue">停止后续上传</n-button>
            </div>
          </div>
          <div class="conversion-queue-section">
            <h3 class="module-section-title">
              当前转换队列 <span>（{{ files.length }} 条）</span>
            </h3>
            <div v-if="files.length" class="conversion-pending">
              <div v-for="(row, index) in files" :key="index" class="conversion-upload">
                <span :title="row.file.name">{{ row.file.name }}</span
                ><n-input
                  v-if="/\.(mgg|mflac)$/i.test(row.file.name)"
                  v-model:value="row.ekey"
                  :disabled="busy"
                  type="password"
                  placeholder="该文件的 EKey（内含密钥时可留空）"
                  :input-props="{ autocomplete: 'off' }"
                /><span>{{ row.state }}</span
                ><span v-if="row.error" class="conversion-error">{{ row.error }}</span>
                <n-button
                  v-if="row.state === '失败' && !busy"
                  @click="
                    row.state = '等待上传';
                    row.error = '';
                    row.id = undefined;
                  "
                  >重新排队</n-button
                >
              </div>
            </div>
            <div v-if="!files.length" class="module-empty">选择音频后，在这里核对文件、识别状态及所需密钥</div>
          </div>
        </div>
        <details class="module-help">
          <summary>格式兼容、去重与文件限制</summary>
          <p>
            kbps 表示每秒保存多少音频数据（码率）。同一音频码率越高，MP3
            通常越大；提高码率不能恢复原音频已丢失的细节。默认 192 kbps，兼顾音质与体积。
          </p>
          <p>相同文件内容、相同码率会复用进行中的任务或已有有效结果；更换码率会重新转换。</p>
          <p>
            单个最大 100 MiB、最长 2
            小时。依次上传并转换；已上传的任务关闭页面后仍继续，尚未上传的文件需重新选择。原文件不会修改。临时副本在任务结束后清理，失败重试需重新上传。
          </p>
        </details>
      </section>
      <section class="conversion-panel record-region">
        <header class="record-heading">
          <strong>转换记录 · 共 {{ total }} 条</strong><n-button size="small" @click="load">刷新</n-button>
        </header>
        <div class="conversion-actions conversion-history-toolbar record-toolbar">
          <n-checkbox
            :checked="
              jobs.some((j) => j.status === 'completed') &&
              jobs.filter((j) => j.status === 'completed').every((j) => selected.includes(j.id))
            "
            :disabled="adding"
            @update:checked="togglePage"
            >全选本页成功结果</n-checkbox
          >
          <span>已选 {{ selected.length }} 条</span>
          <n-button :disabled="!selected.length || adding" @click="openLibrary([...selected], true)"
            >加入所选到音频素材库</n-button
          ><n-button :disabled="!selected.length" @click="downloadZip">下载所选 ZIP</n-button
          ><n-button type="error" :disabled="!selected.length || adding" @click="removeSelected">删除所选</n-button>
        </div>
        <n-alert v-if="libraryReport" :type="libraryFailed ? 'warning' : 'success'">{{ libraryReport }}</n-alert>
        <p class="record-note">转换存储上限 10 GiB。删除转换结果不会删除已经加入素材库的独立副本。</p>
        <article v-for="job in jobs" :key="job.id" class="conversion-job record-card">
          <n-checkbox
            :checked="selected.includes(job.id)"
            :disabled="job.status !== 'completed' || adding"
            :aria-label="`选择 ${job.name}`"
            @update:checked="(checked) => toggle(job.id, checked)"
          />
          <div class="conversion-job-body">
            <strong>{{ job.name }}</strong>
            <p>
              {{ job.format || "待识别" }} · {{ job.bitrate }} kbps ·
              {{ job.duration ? `${job.duration.toFixed(1)} 秒 · ` : "" }}{{ new Date(job.createdAt).toLocaleString() }}
            </p>
            <n-progress
              v-if="job.status === 'pending' || job.status === 'running'"
              type="line"
              :percentage="Math.floor(job.progress)"
            />
            <p>{{ labels[job.status] }}{{ job.error ? `：${job.error}` : "" }}</p>
          </div>
          <div class="conversion-actions">
            <template v-if="job.status === 'completed'"
              ><n-button tag="a" :href="api.download(job.id)">下载 MP3</n-button
              ><n-button @click="playing = playing === job.id ? '' : job.id">{{
                playing === job.id ? "收起试听" : "试听"
              }}</n-button
              ><n-button :disabled="adding" @click="openLibrary([job.id])">加入音频素材库</n-button></template
            ><n-button v-if="['pending', 'running'].includes(job.status)" @click="action(() => api.cancel(job.id))"
              >取消转换</n-button
            ><template v-else
              ><n-button v-if="job.status !== 'completed'" @click="input?.click()">重新上传重试</n-button
              ><n-button type="error" @click="removeOne(job.id)">删除记录</n-button></template
            >
          </div>
          <ExtractionAudioPreview
            v-if="playing === job.id && job.status === 'completed'"
            :key="job.id"
            class="conversion-audio-preview"
            :url="api.download(job.id)"
            :title="job.name"
            :duration="job.duration ?? 0"
            :bytes="job.bytes"
          />
        </article>
        <p v-if="!jobs.length">暂无转换记录</p>
        <footer v-if="total" class="conversion-pagination record-pagination">
          <span>共 {{ total }} 条</span>
          <n-pagination v-model:page="page" :page-size="50" :item-count="total" />
        </footer>
      </section>
      <n-modal
        v-model:show="libraryVisible"
        preset="card"
        :title="`加入音频素材库（${libraryIds.length} 条）`"
        :closable="!adding"
        :mask-closable="!adding"
        :close-on-esc="!adding"
        style="width: min(480px, 95vw)"
        ><div class="conversion-library">
          <p>已存在的音频保留原分组与用途，不会重复加入；回收站中的音频需先恢复。</p>
          <p v-if="adding">正在加入 {{ importDone }} / {{ libraryIds.length }} 条，请稍候…</p>
          <n-alert v-if="libraryReport" :type="libraryFailed ? 'warning' : 'success'">{{ libraryReport }}</n-alert>
          <n-select
            v-model:value="purpose"
            aria-label="用途"
            :disabled="adding"
            :options="[
              { label: '背景音乐', value: 'music' },
              { label: '配音', value: 'speech' },
              { label: '通用音频', value: 'general' }
            ]"
          /><n-select
            v-model:value="groupId"
            :options="groups"
            clearable
            placeholder="不分组"
            aria-label="目标分组"
            :disabled="adding"
          /><n-button type="primary" :loading="adding" @click="addLibrary">{{
            hasEditor && !libraryBatch ? "加入并返回视频编辑" : libraryFailed ? "重试未加入项" : "加入素材库"
          }}</n-button>
        </div></n-modal
      >
    </section></ToolLayout
  >
</template>
<script setup lang="ts">
import { UploadCloud } from "lucide-vue-next";
import { computed, ref, watch, onScopeDispose } from "vue";
import { AUDIO_CONVERT_MAX_FILES } from "@toolbox/shared/audio-convert";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { NAlert, NButton, NSelect, NInput, NCheckbox, NProgress, NPagination, NModal, useMessage } from "naive-ui";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { conversionLibraryApi } from "../audio-library/integrations/conversion";
import { audioConvertApi as api } from "./api";
import { useConversion } from "./useConversion";
import ExtractionAudioPreview from "../audio-extract/ExtractionAudioPreview.vue";
const { files, jobs, page, total, error, bitrate, busy, selected, remaining, choose, start, stopQueue, load } =
  useConversion();
const playing = ref("");
watch(jobs, (records) => {
  if (!records.some((job) => job.id === playing.value && job.status === "completed")) playing.value = "";
});
const input = ref<HTMLInputElement>(),
  route = useRoute(),
  router = useRouter(),
  confirm = useConfirmDialog(),
  message = useMessage();
const labels: Record<string, string> = {
  pending: "排队中",
  running: "正在转换",
  completed: "已完成",
  failed: "失败",
  canceled: "已取消"
};
const libraryVisible = ref(false),
  adding = ref(false),
  libraryIds = ref<string[]>([]),
  libraryBatch = ref(false),
  importDone = ref(0),
  libraryReport = ref(""),
  libraryFailed = ref(0),
  groupId = ref<string | null>(null),
  purpose = ref("music"),
  groups = ref<Array<{ label: string; value: string }>>([]);
const hasEditor = computed(() =>
  [route.query.archiveId, route.query.mediaId].every((v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(v))
);
let disposed = false,
  libraryRequest = 0;
onScopeDispose(() => {
  disposed = true;
});
function selectFiles(event: Event) {
  const el = event.target as HTMLInputElement;
  choose(Array.from(el.files ?? []));
  el.value = "";
}
function toggle(id: string, checked: boolean) {
  setSelection(checked ? [...selected.value, id] : selected.value.filter((v) => v !== id));
}
function setSelection(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length > AUDIO_CONVERT_MAX_FILES) {
    error.value = "每次最多选择 1000 条，请分批处理";
    return;
  }
  selected.value = unique;
}
function togglePage(checked: boolean) {
  const ids = jobs.value.filter((j) => j.status === "completed").map((j) => j.id);
  setSelection(checked ? [...selected.value, ...ids] : selected.value.filter((id) => !ids.includes(id)));
}
async function action(fn: () => Promise<unknown>) {
  try {
    await fn();
    await load();
  } catch (e) {
    error.value = formatApiError(e);
  }
}
async function removeOne(id: string) {
  if (await confirm("永久删除这条转换记录及转换文件？素材库中的独立副本保留。", { title: "删除转换记录" }))
    await action(async () => {
      await api.remove(id);
      selected.value = selected.value.filter((value) => value !== id);
    });
}
async function removeSelected() {
  if (await confirm(`永久删除所选 ${selected.value.length} 个转换结果？`, { title: "删除所选" }))
    await action(async () => {
      for (const id of [...selected.value]) {
        await api.remove(id);
        selected.value = selected.value.filter((value) => value !== id);
      }
    });
}
async function downloadZip() {
  await action(async () => {
    const result = await api.zip(selected.value);
    window.location.assign(resolveBackendUrl(result.url));
  });
}
async function openLibrary(ids: string[], batch = false) {
  if (adding.value || !ids.length) return;
  const request = ++libraryRequest;
  await action(async () => {
    const data = await conversionLibraryApi.list({ pageSize: 1 });
    if (disposed || request !== libraryRequest) return;
    groups.value = data.groups.map((g) => ({ label: g.name, value: g.id }));
    libraryIds.value = [...ids];
    libraryBatch.value = batch;
    if (hasEditor.value && !batch) purpose.value = "music";
    libraryReport.value = "";
    libraryFailed.value = 0;
    libraryVisible.value = true;
  });
}
async function addLibrary() {
  if (adding.value || !libraryIds.value.length) return;
  adding.value = true;
  importDone.value = 0;
  libraryReport.value = "";
  libraryFailed.value = 0;
  error.value = "";
  const ids = [...libraryIds.value],
    targetGroup = groupId.value,
    targetPurpose = purpose.value,
    failed: string[] = [],
    succeeded: string[] = [];
  let added = 0,
    existing = 0,
    firstError = "";
  let returnMusic: string | undefined;
  try {
    for (const id of ids) {
      if (disposed) return;
      try {
        const result = await api.add(id, targetGroup, targetPurpose);
        if (result.item.deletedAt) throw new Error("相同音频已在素材库回收站，请先恢复后选择");
        if (result.existing) existing++;
        else added++;
        succeeded.push(id);
        returnMusic = result.item.id;
      } catch (e) {
        failed.push(id);
        firstError ||= e instanceof Error && e.message.includes("回收站") ? e.message : formatApiError(e);
      }
      importDone.value++;
    }
    if (disposed) return;
    libraryFailed.value = failed.length;
    libraryReport.value = `新增 ${added} 条，已存在 ${existing} 条，失败 ${failed.length} 条${firstError ? `；${firstError}` : ""}`;
    if (libraryBatch.value) selected.value = selected.value.filter((id) => !succeeded.includes(id));
    libraryIds.value = failed;
    if (failed.length) {
      error.value = firstError;
      return;
    }
    libraryVisible.value = false;
    message.success(libraryReport.value);
    adding.value = false;
    if (hasEditor.value && !libraryBatch.value && returnMusic)
      await router.push({
        name: "archive-video-editor",
        params: { itemId: String(route.query.archiveId), mediaId: String(route.query.mediaId) },
        query: {
          panel: "audio",
          convertedMusic: returnMusic,
          ...(typeof route.query.returnTo === "string" && /^\/tools\/media-archive(?:\?|$)/.test(route.query.returnTo)
            ? { returnTo: route.query.returnTo }
            : {})
        }
      });
  } catch (e) {
    error.value = formatApiError(e);
  } finally {
    adding.value = false;
  }
}
onBeforeRouteLeave(
  () =>
    (!adding.value && !busy.value && !remaining.value) ||
    confirm(
      adding.value
        ? "离开会停止后续加入操作，已加入的素材保留。确定离开？"
        : "离开后已上传任务会继续，未上传文件和未提交的 EKey 不会保留。确定离开？",
      { danger: false }
    )
);
</script>
<style scoped>
.conversion-page {
  grid-column: 1/-1;
  display: grid;
  gap: 20px;
  min-width: 0;
}
.conversion-panel {
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: 20px;
  background: var(--color-surface);
  min-width: 0;
}
.conversion-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.conversion-actions > .n-select {
  width: 230px;
  max-width: 100%;
}
.conversion-panel p {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.conversion-pending {
  max-height: 260px;
  overflow: auto;
}
.conversion-upload {
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(100px, 1fr) auto;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}
.conversion-upload > span:first-child {
  overflow-wrap: anywhere;
}
.conversion-error {
  grid-column: 1/-1;
  color: #c33;
}
.conversion-job {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 18px 0;
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}
.conversion-job-body {
  flex: 1;
  min-width: 200px;
  overflow-wrap: anywhere;
}
.conversion-job > .conversion-audio-preview {
  flex: 0 0 100%;
  min-width: 0;
  margin-top: 0;
}
.conversion-library {
  display: grid;
  gap: 16px;
}
@media (max-width: 768px) {
  .conversion-upload {
    grid-template-columns: 1fr;
  }
  .conversion-job > .conversion-actions {
    width: 100%;
  }
}

.conversion-setup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}
.conversion-upload-section,
.conversion-queue-section {
  min-width: 0;
}
.conversion-queue-section {
  border-left: 1px solid var(--color-border);
  padding-left: 24px;
}
.module-section-title {
  font-size: 18px;
  line-height: 26px;
  margin: 0 0 16px;
}
.module-section-title span {
  font-weight: 400;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.conversion-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 180px;
  padding: 24px;
  border: 1px dashed var(--color-primary-200);
  border-radius: 10px;
  background: var(--color-surface-subtle);
  color: var(--color-primary-700);
  cursor: pointer;
  text-align: center;
}
.conversion-drop strong {
  font-size: 18px;
}
.conversion-drop span {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.conversion-drop[aria-disabled="true"] {
  cursor: not-allowed;
}
.conversion-bitrate {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}
.conversion-bitrate .n-select {
  width: 230px;
  max-width: 100%;
}
.conversion-start {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.conversion-upload-section > :deep(.n-alert) {
  margin-top: 12px;
  font-size: 12px;
}
.conversion-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 13px;
}
.conversion-pagination > span {
  white-space: nowrap;
}
.conversion-history-toolbar {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
  gap: 12px;
}
.conversion-history-toolbar > strong {
  font-size: 18px;
  margin-right: auto;
}
.conversion-pending {
  margin: 0;
  max-height: 340px;
  overflow: auto;
}
.conversion-upload {
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.conversion-upload > span:first-child {
  width: 100%;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.module-empty {
  display: grid;
  place-content: center;
  min-height: 240px;
  text-align: center;
  color: var(--color-text-secondary);
  padding: 20px;
  font-size: 13px;
}
.module-help {
  padding-top: 14px;
  margin-top: 20px;
  border-top: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-secondary);
}
.module-help summary {
  cursor: pointer;
}
.conversion-job {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-subtle);
  padding: 16px;
  margin-top: 12px;
}
@media (max-width: 900px) {
  .conversion-setup-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .conversion-queue-section {
    padding: 20px 0 0;
    border-left: 0;
    border-top: 1px solid var(--color-border);
  }
}
</style>
