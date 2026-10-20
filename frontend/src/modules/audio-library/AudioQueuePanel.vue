<template>
  <section class="workspace-panel audio-queue-panel" aria-label="音频队列管理">
    <header class="audio-queue-heading">
      <div>
        <strong>播放队列</strong>
        <p>编排当前队列，保存为预设；加载后保持暂停，点击播放器开始播放。</p>
      </div>
      <n-button :disabled="!player.queue.length" @click="openSave()">保存当前队列为预设</n-button>
    </header>
    <n-tabs v-model:value="tab" type="line" animated>
      <n-tab-pane name="current" :tab="`当前队列（${player.queue.length}）`">
        <div class="audio-queue-actions">
          <span>{{ modeLabel(player.mode) }} · 间隔 {{ player.gap }} 秒 · 可重复添加同一音频</span
          ><n-button size="small" :disabled="!player.queue.length" @click="clearQueue">清空当前队列</n-button>
        </div>
        <ol v-if="player.queue.length" class="audio-queue-entries">
          <li
            v-for="(entry, index) in player.queue"
            :key="entry.entryId"
            draggable="true"
            @dragstart="dragged = index"
            @dragend="dragged = -1"
            @dragover.prevent
            @drop.prevent="player.reorder(dragged, index)"
          >
            <span class="audio-queue-number">{{ index + 1 }}</span>
            <div class="audio-queue-copy">
              <n-button
                class="audio-queue-entry-title"
                title="定位到此条，保持暂停，不自动播放"
                text
                :type="player.currentId === entry.entryId ? 'primary' : 'default'"
                @click="player.select(entry.entryId)"
                ><span class="audio-queue-field-label">标题：</span>{{ entry.item.title }}</n-button
              >
              <p class="audio-queue-entry-chinese">
                <span class="audio-queue-field-label">中文：</span>{{ entry.item.chineseText.trim() || "暂无中文译文" }}
              </p>
              <p class="audio-queue-entry-foreign">
                <span class="audio-queue-field-label">外语：</span>{{ entry.item.foreignText.trim() || "暂无外语文案" }}
              </p>
            </div>
            <span class="audio-queue-duration">{{ formatDuration(entry.item.duration) }}</span>
            <div class="audio-queue-row-actions">
              <n-button
                class="audio-queue-play-once"
                size="tiny"
                type="primary"
                secondary
                :disabled="!entry.item.available"
                :aria-label="`单次播放第 ${index + 1} 条：${entry.item.title}`"
                title="仅播放一次，结束后停止"
                @click.stop="player.playOnce(entry.entryId)"
                >单次播放</n-button
              ><n-button size="tiny" :disabled="index === 0" @click="player.reorder(index, index - 1)">上移</n-button
              ><n-button
                size="tiny"
                :disabled="index === player.queue.length - 1"
                @click="player.reorder(index, index + 1)"
                >下移</n-button
              ><n-button size="tiny" @click="player.remove(entry.entryId)">移除</n-button>
            </div>
          </li>
        </ol>
        <n-empty v-else description="队列为空，从下方音频加入，或加载一个预设队列" />
      </n-tab-pane>
      <n-tab-pane name="presets" :tab="`预设队列（${presets.length}）`">
        <div class="audio-queue-actions">
          <n-input v-model:value="keyword" clearable placeholder="搜索预设队列名称" /><n-button
            size="small"
            :loading="loading"
            @click="refresh"
            >刷新列表</n-button
          >
        </div>
        <n-alert v-if="error" type="error">{{ error }}</n-alert>
        <n-spin :show="loading"
          ><div class="audio-presets">
            <article v-for="preset in filtered" :key="preset.id" class="audio-preset">
              <div class="audio-preset-top">
                <div class="audio-queue-copy">
                  <strong>{{ preset.name }}</strong>
                  <p>{{ preset.itemIds.length }} 条 · {{ modeLabel(preset.mode) }} · 间隔 {{ preset.gap }} 秒</p>
                </div>
                <div class="audio-queue-row-actions">
                  <n-button
                    size="small"
                    type="primary"
                    :loading="busy === preset.id"
                    :disabled="Boolean(busy)"
                    @click="load(preset)"
                    >加载队列</n-button
                  ><n-button size="small" @click="showContents(preset)">{{
                    contents[preset.id] ? "收起内容" : "查看内容"
                  }}</n-button
                  ><n-button size="small" @click="openSave(preset, 'rename')">重命名</n-button
                  ><n-button size="small" :disabled="!player.queue.length" @click="openSave(preset, 'update')"
                    >用当前队列更新</n-button
                  ><n-button size="small" type="error" :disabled="Boolean(busy)" @click="remove(preset)"
                    >删除预设</n-button
                  >
                </div>
              </div>
              <ol v-if="contents[preset.id]" class="audio-preset-contents">
                <li v-for="(item, index) in presetRows(preset)" :key="index">
                  <template v-if="item">
                    <strong class="audio-preset-item-title">{{ item.title }}</strong>
                    <p class="audio-preset-chinese">
                      <span>中文：</span>{{ item.chineseText.trim() || "暂无中文译文" }}
                    </p>
                    <p v-if="item.foreignText.trim()" class="audio-preset-foreign">
                      <span>外语：</span>{{ item.foreignText }}
                    </p>
                  </template>
                  <span v-else>音频已删除、在回收站或文件不可用（加载时跳过）</span>
                </li>
              </ol>
            </article>
            <n-empty
              v-if="!filtered.length && !loading"
              :description="keyword ? '未找到匹配的预设队列' : '还没有预设，先整理当前队列，再保存为预设'"
            /></div
        ></n-spin>
      </n-tab-pane>
    </n-tabs>
    <n-modal v-model:show="saveVisible"
      ><n-card
        :title="
          saveKind === 'rename' ? '重命名预设队列' : saveKind === 'update' ? '用当前队列更新预设' : '保存为预设队列'
        "
        class="audio-preset-dialog"
        closable
        @close="saveVisible = false"
        ><n-form label-placement="top"
          ><n-form-item label="预设名称"
            ><n-input
              v-model:value="draft.name"
              maxlength="80"
              placeholder="例如：马来语开场 / 晚场促销" /></n-form-item
          ><template v-if="saveKind !== 'rename'"
            ><p>保存 {{ draft.itemIds.length }} 条音频，保留当前顺序与重复项。</p>
            <n-form-item label="播放方式"><n-select v-model:value="draft.mode" :options="modes" /></n-form-item
            ><n-form-item label="播放间隔（秒）"
              ><n-input-number
                v-model:value="draftGap"
                :min="0"
                :max="300"
                :precision="1" /></n-form-item></template></n-form
        ><n-alert v-if="saveKind === 'update'" type="warning">将替换该预设的内容，不影响音频文件和其他预设。</n-alert
        ><template #footer
          ><n-button type="primary" :loading="saving" :disabled="!draft.name.trim() || draftGap === null" @click="save"
            >确认保存</n-button
          ></template
        ></n-card
      ></n-modal
    >
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  NButton,
  NTabs,
  NTabPane,
  NInput,
  NInputNumber,
  NAlert,
  NSpin,
  NEmpty,
  NModal,
  NCard,
  NForm,
  NFormItem,
  NSelect,
  useMessage
} from "naive-ui";
import type { AudioLibraryPreset, AudioLibraryPresetInput, AudioLibraryItemView } from "@toolbox/shared";
import { audioLibraryApi as api, formatDuration } from "./api";
import { audioLibraryPlayer as player } from "./player";
import { formatApiError } from "../../services/http";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
const message = useMessage(),
  confirm = useConfirmDialog();
const tab = ref("current"),
  presets = ref<AudioLibraryPreset[]>([]),
  loading = ref(false),
  error = ref(""),
  keyword = ref(""),
  busy = ref("");
const contents = reactive<Record<string, AudioLibraryItemView[]>>({});
const modes = [
  { label: "顺序播放", value: "sequence" },
  { label: "列表循环", value: "list" },
  { label: "单曲循环", value: "single" }
];
const modeLabel = (value: string) => modes.find((x) => x.value === value)?.label || value;
const filtered = computed(() =>
  presets.value.filter((x) => x.name.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase()))
);
let dragged = -1;
async function refresh() {
  loading.value = true;
  try {
    presets.value = await api.presets();
    error.value = "";
    for (const id of Object.keys(contents)) delete contents[id];
  } catch (e) {
    error.value = formatApiError(e);
  } finally {
    loading.value = false;
  }
}
onMounted(() => void refresh());
defineExpose({ refresh });
function presetRows(preset: AudioLibraryPreset) {
  const items = new Map((contents[preset.id] ?? []).map((item) => [item.id, item]));
  return preset.itemIds.map((id) => items.get(id));
}
async function showContents(preset: AudioLibraryPreset) {
  if (contents[preset.id]) {
    delete contents[preset.id];
    return;
  }
  try {
    contents[preset.id] = (await api.loadPreset(preset.id)).items;
  } catch (e) {
    message.error(formatApiError(e));
  }
}
async function load(preset: AudioLibraryPreset) {
  if (busy.value) return;
  busy.value = preset.id;
  try {
    const result = await api.loadPreset(preset.id);
    if (!result.items.length) {
      message.warning("该预设没有可用音频，当前队列未改变");
      return;
    }
    const skip = result.unavailableCount ? `其中 ${result.unavailableCount} 条已删除或不可用，将跳过。` : "";
    if (
      (player.queue.length || player.preview) &&
      !(await confirm(`加载“${result.preset.name}”将停止当前播放，并替换当前队列。${skip}加载后不会自动播放。`, {
        title: "加载预设队列",
        danger: false
      }))
    )
      return;
    player.replaceQueue(result.items, result.preset);
    tab.value = "current";
    if (skip) message.warning(`已加载 ${result.items.length} 条，跳过 ${result.unavailableCount} 条不可用音频`);
    else message.success(`已加载“${result.preset.name}”，点击播放开始`);
  } catch (e) {
    message.error(formatApiError(e));
  } finally {
    busy.value = "";
  }
}
async function clearQueue() {
  if (
    await confirm("清空当前播放队列并停止播放？已保存的预设和音频不受影响。", { title: "清空当前队列", danger: false })
  )
    player.clear();
}
async function remove(preset: AudioLibraryPreset) {
  if (
    busy.value ||
    !(await confirm(`删除预设“${preset.name}”？不会删除音频，也不会改变当前播放队列。`, { title: "删除预设队列" }))
  )
    return;
  busy.value = preset.id;
  try {
    await api.deletePreset(preset.id, preset.revision);
    await refresh();
    message.success("预设已删除，音频和当前队列均保留");
  } catch (e) {
    message.error(formatApiError(e));
  } finally {
    busy.value = "";
  }
}
const saveVisible = ref(false),
  saveKind = ref<"create" | "rename" | "update">("create"),
  editing = ref<AudioLibraryPreset>(),
  saving = ref(false),
  draftGap = ref<number | null>(1);
const draft = reactive<AudioLibraryPresetInput>({ name: "", itemIds: [], mode: "sequence", gap: 1 });
function openSave(preset?: AudioLibraryPreset, kind: "create" | "rename" | "update" = "create") {
  if (kind !== "rename" && !player.queue.length) return;
  editing.value = preset;
  saveKind.value = kind;
  Object.assign(draft, {
    name: preset?.name || "",
    itemIds: kind === "rename" ? [...preset!.itemIds] : player.queue.map((x) => x.item.id),
    mode: kind === "rename" ? preset!.mode : player.mode,
    gap: kind === "rename" ? preset!.gap : player.gap,
    revision: preset?.revision
  });
  draftGap.value = draft.gap;
  saveVisible.value = true;
}
async function save() {
  if (saving.value || draftGap.value === null) return;
  saving.value = true;
  try {
    await api.savePreset({ ...draft, gap: draftGap.value }, editing.value?.id);
    saveVisible.value = false;
    keyword.value = "";
    tab.value = "presets";
    await refresh();
    message.success("预设队列已保存");
  } catch (e) {
    message.error(formatApiError(e));
  } finally {
    saving.value = false;
  }
}
</script>
<style scoped>
.audio-queue-panel {
  margin-top: 20px;
}
.audio-queue-heading,
.audio-queue-actions,
.audio-preset-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.audio-queue-heading p,
.audio-queue-copy p,
.audio-queue-actions > span {
  font-size: 12px;
  color: #64748b;
  margin: 5px 0;
}
.audio-queue-actions {
  margin: 0 0 12px;
}
.audio-queue-actions > .n-input {
  max-width: 320px;
}
.audio-queue-entries {
  list-style: none;
  padding: 0;
  max-height: 420px;
  overflow: auto;
}
.audio-queue-entries > li {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto auto;
  align-items: start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #edf1f7;
}
.audio-queue-number {
  color: #94a3b8;
  min-width: 24px;
}
.audio-queue-copy {
  min-width: 0;
  flex: 1;
}
.audio-queue-copy p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.audio-queue-copy :deep(.n-button) {
  max-width: 100%;
}
.audio-queue-copy :deep(.n-button__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.audio-queue-copy :deep(.audio-queue-entry-title) {
  height: auto;
  text-align: left;
  white-space: normal;
  line-height: 1.6;
}
.audio-queue-copy :deep(.audio-queue-entry-title .n-button__content),
.audio-queue-entries .audio-queue-copy p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: visible;
  text-overflow: clip;
}
.audio-queue-entries .audio-queue-copy p {
  margin: 6px 0 0;
  line-height: 1.65;
}
.audio-queue-copy .audio-queue-entry-chinese {
  color: #172033;
}
.audio-queue-field-label {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 400;
}
.audio-queue-duration {
  white-space: nowrap;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.9;
}
.audio-queue-row-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.audio-presets {
  max-height: 400px;
  overflow: auto;
}
.audio-preset {
  padding: 14px 0;
  border-bottom: 1px solid #edf1f7;
}
.audio-preset-contents {
  font-size: 13px;
  color: #475569;
  max-height: 220px;
  overflow: auto;
  line-height: 2;
}
.audio-preset-contents > li {
  padding: 8px 0;
  border-bottom: 1px solid #edf1f7;
  overflow-wrap: anywhere;
}
.audio-preset-item-title,
.audio-preset-chinese {
  color: #172033;
}
.audio-preset-contents p {
  margin: 4px 0;
  line-height: 1.6;
  white-space: pre-wrap;
}
.audio-preset-foreign {
  font-size: 12px;
  color: #64748b;
}
.audio-preset-dialog {
  width: min(480px, calc(100vw - 32px));
}
@media (max-width: 760px) {
  .audio-queue-heading,
  .audio-preset-top {
    align-items: flex-start;
    flex-direction: column;
  }
  .audio-queue-entries > li {
    grid-template-columns: 24px minmax(0, 1fr) auto;
  }
  .audio-queue-entries .audio-queue-row-actions {
    grid-column: 2 / -1;
  }
  .audio-queue-row-actions {
    justify-content: flex-start;
  }
}
</style>
