<template>
  <ToolLayout
    ><section class="extraction-page v2-tool-page">
      <ToolPageHeader
        title="音频提取器"
        kicker="AUDIO EXTRACTOR"
        description="从视频提取独立音轨，支持 MP3 和原编码输出，原视频保持不变。"
      />
      <n-alert v-if="error" type="error" closable @close="error = ''">{{ error }}</n-alert>
      <ExtractionOptions
        v-model:format="format"
        v-model:bitrate="bitrate"
        v-model:policy="policy"
        :busy="busy"
        :remaining="remaining"
        @choose="choose"
        @start="start"
        @stop="stopQueue"
      />
      <section v-if="files.length" class="panel queue">
        <strong>本次队列 · {{ files.length }} 个视频</strong>
        <article v-for="(row, i) in files" :key="i">
          <strong class="filename">{{ row.file.name }}</strong
          ><span>{{ formatBytesAdaptive(row.file.size) }} · {{ row.state }} · {{ row.progress }}%</span
          ><span v-if="row.error" class="error">{{ row.error }}</span>
          <template v-if="row.source"
            ><span>已识别 {{ row.source.tracks.length }} 条音轨</span>
            <n-select
              v-if="waiting === row"
              v-model:value="row.tracks"
              multiple
              aria-label="选择音轨"
              :options="
                row.source.tracks.map((t) => ({
                  value: t.index,
                  label: `音轨 ${t.index} · ${t.language} · ${t.title || t.codec} · ${t.channels} 声道`
                }))
              "
            />
            <n-button v-if="waiting === row" :disabled="!row.tracks.length" @click="confirmRow"
              >确认音轨并继续</n-button
            >
          </template>
          <n-button
            v-if="busy && ['正在上传', '识别音轨', '请选择音轨'].includes(row.state)"
            size="small"
            @click="cancelRow(row)"
            >取消此项</n-button
          >
          <n-button
            v-if="!busy && ['失败', '部分失败或已取消', '已取消'].includes(row.state)"
            size="small"
            @click="retry(row)"
            >重新排队</n-button
          >
        </article>
      </section>
      <section class="panel record-region">
        <div class="actions record-heading">
          <strong>提取记录 · 共 {{ total }} 条</strong><n-button size="small" @click="load">刷新</n-button>
        </div>
        <div class="actions selection record-toolbar">
          <n-checkbox :checked="pageSelected" :disabled="adding" @update:checked="togglePage"
            >全选本页成功结果</n-checkbox
          >
          <span>已选 {{ selected.length }} 条</span>
          <n-button size="small" :disabled="!selected.length || adding" @click="zip">下载所选 ZIP</n-button>
          <n-button size="small" :disabled="!selected.length || adding" @click="openLibrary([...selected])"
            >所选加入素材库</n-button
          >
          <n-button size="small" type="error" :disabled="!selected.length || adding" @click="remove([...selected])"
            >删除所选</n-button
          >
        </div>
        <p class="hint record-note">
          成功结果长期保留，存储上限 20 GiB。删除提取结果不会删除原视频或素材库中的独立副本。
        </p>
        <ExtractionList
          :jobs="jobs"
          :selected="selected"
          :locked="adding"
          @select="select"
          @cancel="cancel"
          @remove="(id) => remove([id])"
          @library="(id) => openLibrary([id])"
        />
        <footer v-if="total" class="record-pagination">
          <span>共 {{ total }} 条</span><n-pagination v-model:page="page" :page-size="50" :item-count="total" />
        </footer>
      </section>
      <n-modal
        v-model:show="libraryOpen"
        preset="card"
        title="加入音频素材库"
        :closable="!adding"
        :mask-closable="!adding"
        :close-on-esc="!adding"
        style="width: min(480px, 95vw)"
      >
        <div class="library-form">
          <p>
            已选
            {{ libraryIds.length }}
            条；已有相同音频会复用，原分组和用途保留。单条素材最大 100 MiB。
          </p>
          <n-select
            v-model:value="groupId"
            :disabled="adding"
            clearable
            aria-label="目标分组"
            placeholder="不分组"
            :options="groups"
          />
          <n-select
            v-model:value="purpose"
            :disabled="adding"
            aria-label="音频用途"
            :options="[
              { label: '背景音乐', value: 'music' },
              { label: '配音', value: 'speech' },
              { label: '通用音频', value: 'general' }
            ]"
          />
          <n-checkbox v-model:checked="libraryMp3" :disabled="adding"
            >生成 MP3 副本后加入（192 kbps，适用于 OGG 等不兼容格式）</n-checkbox
          >
          <n-alert v-if="report" :type="failedIds.length ? 'warning' : 'success'">{{ report }}</n-alert>
          <n-button type="primary" :loading="adding" @click="addLibrary">{{
            failedIds.length ? "重试未加入项" : "加入素材库"
          }}</n-button>
        </div>
      </n-modal>
    </section></ToolLayout
  >
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue";
import { formatBytesAdaptive } from "../../shared/utils/format-bytes";
import { onBeforeRouteLeave } from "vue-router";
import { NAlert, NButton, NCheckbox, NSelect, NModal, NPagination } from "naive-ui";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { extractionLibraryApi } from "../audio-library/integrations/extraction";
import { audioExtractApi as api } from "./api";
import { useAudioExtraction } from "./useAudioExtraction";
import ExtractionOptions from "./ExtractionOptions.vue";
import ExtractionList from "./ExtractionList.vue";
const {
  files,
  jobs,
  page,
  total,
  error,
  busy,
  selected,
  format,
  bitrate,
  policy,
  waiting,
  remaining,
  choose,
  start,
  stopQueue,
  cancelRow,
  confirmRow,
  retry,
  select,
  load
} = useAudioExtraction();
const confirm = useConfirmDialog(),
  adding = ref(false),
  libraryOpen = ref(false),
  groups = ref<Array<{ label: string; value: string }>>([]),
  groupId = ref<string | null>(null),
  purpose = ref<"music" | "speech" | "general">("music"),
  libraryMp3 = ref(false),
  libraryIds = ref<string[]>([]),
  failedIds = ref<string[]>([]),
  report = ref("");
let disposed = false,
  libraryRequest = 0;
onScopeDispose(() => {
  disposed = true;
});
const pageSelected = computed(
  () =>
    jobs.value.some((j) => j.status === "completed") &&
    jobs.value.filter((j) => j.status === "completed").every((j) => selected.value.includes(j.id))
);
function togglePage(checked: boolean) {
  for (const j of jobs.value.filter((j) => j.status === "completed")) select(j.id, checked);
}
async function cancel(id: string) {
  try {
    await api.cancel(id);
    await load();
  } catch (e) {
    if (!disposed) error.value = formatApiError(e);
  }
}
async function remove(ids: string[]) {
  if (
    !(await confirm(`永久删除所选 ${ids.length} 条提取记录及音频？原视频和素材库副本保留。`, { title: "删除提取记录" }))
  )
    return;
  const failures: string[] = [];
  for (const id of ids) {
    if (disposed) break;
    try {
      await api.remove(id);
      selected.value = selected.value.filter((x) => x !== id);
    } catch (e) {
      failures.push(formatApiError(e));
    }
  }
  if (!disposed) {
    if (failures.length) error.value = `${failures.length} 条删除失败：${failures[0]}`;
    await load();
  }
}
async function zip() {
  try {
    const ticket = await api.zip([...selected.value]);
    if (!disposed) window.location.assign(resolveBackendUrl(ticket.url));
  } catch (e) {
    if (!disposed) error.value = formatApiError(e);
  }
}
async function openLibrary(ids: string[]) {
  const request = ++libraryRequest;
  try {
    const data = await extractionLibraryApi.list({ pageSize: 1 });
    if (disposed || request !== libraryRequest) return;
    groups.value = data.groups.map((g) => ({ label: g.name, value: g.id }));
    libraryIds.value = ids;
    failedIds.value = [];
    report.value = "";
    libraryOpen.value = true;
  } catch (e) {
    if (!disposed) error.value = formatApiError(e);
  }
}
async function addLibrary() {
  if (adding.value) return;
  adding.value = true;
  const input = failedIds.value.length ? [...failedIds.value] : [...libraryIds.value],
    failed: string[] = [];
  let done = 0,
    message = "";
  try {
    for (const id of input) {
      if (disposed) break;
      try {
        await api.library(id, groupId.value, purpose.value, libraryMp3.value);
        done++;
      } catch (e) {
        failed.push(id);
        message = formatApiError(e);
      }
      if (!disposed) report.value = `已加入或复用 ${done}/${input.length} 条`;
    }
    if (!disposed) {
      failedIds.value = failed;
      report.value = `已加入或复用 ${done} 条，失败 ${failed.length} 条${message ? `：${message}` : ""}`;
    }
  } finally {
    adding.value = false;
  }
}
onBeforeRouteLeave(
  () =>
    !(busy.value || remaining.value || adding.value) ||
    confirm("离开后已提交的提取任务继续，未上传的视频和后续加入操作会停止。确定离开？", { danger: false })
);
</script>
<style scoped>
.extraction-page {
  grid-column: 1/-1;
  display: grid;
  gap: 20px;
  min-width: 0;
}
.panel {
  box-shadow: var(--shadow-card);
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.selection {
  margin: 16px 0;
}
.hint {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.queue {
  max-height: 400px;
  overflow: auto;
}
.queue article {
  padding: 12px 0;
  border-bottom: 1px solid #e4eaf2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.filename {
  overflow-wrap: anywhere;
}
.queue .n-select {
  width: min(500px, 100%);
}
.error {
  color: #c42828;
}
.library-form {
  display: grid;
  gap: 16px;
}
.pagination-with-total {
  margin-top: 20px;
}
</style>
