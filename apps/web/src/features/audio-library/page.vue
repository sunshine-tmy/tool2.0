<template>
  <ToolLayout>
    <section class="main-column library-page v2-tool-page">
      <ToolPageHeader
        title="音频素材库"
        description="永久保存配音、背景音乐与双语文案，按分组查找，用于播放队列或归档视频配乐。"
        kicker="AUDIO LIBRARY"
      />
      <input ref="backupInput" hidden type="file" accept=".zip" @change="restoreBackup" />

      <n-alert v-if="error" type="error" closable @close="error = ''"
        >{{ error }} <n-button text @click="load">重试</n-button></n-alert
      >
      <n-alert v-if="undoToken" type="success" closable @close="undoToken = ''"
        >已移动到目标分组。<n-button text @click="undoMove">撤销移动</n-button></n-alert
      >
      <div class="library-workspace">
        <section class="workspace-panel library-toolbar" aria-label="音频筛选与管理">
          <div class="library-primary-filters">
            <n-input v-model:value="keyword" clearable placeholder="搜索音频名称、文案或备注">
              <template #prefix><Search :size="17" /></template>
            </n-input>
            <div class="library-purpose-filter">
              <span>素材类型</span>
              <nav class="library-view-strip" aria-label="素材分类">
                <button
                  v-for="entry in views.filter((x) => ['all', 'music', 'speech'].includes(x.value))"
                  :key="entry.value"
                  class="library-view"
                  :class="{ active: view === entry.value }"
                  @click="chooseView(entry.value)"
                >
                  {{ entry.value === "all" ? "全部素材" : entry.label }}
                </button>
              </nav>
            </div>
            <div class="library-group-filter">
              <span>所属分组</span>
              <n-select
                :value="groupId"
                clearable
                filterable
                placeholder="全部分组"
                :options="groups"
                @update:value="(value) => selectGroup(value ? [value] : [])"
              />
            </div>
            <n-button type="primary" class="library-upload-button" @click="uploadVisible = true">
              <template #icon><Upload :size="18" /></template>上传音频
            </n-button>
          </div>
          <div class="library-management">
            <n-button
              :type="groupManagerOpen ? 'primary' : 'default'"
              :secondary="groupManagerOpen"
              @click="groupManagerOpen = !groupManagerOpen"
            >
              <template #icon><FolderOpen :size="17" /></template>管理分组
            </n-button>
            <n-button
              :type="view === 'trash' ? 'primary' : 'default'"
              @click="chooseView(view === 'trash' ? 'all' : 'trash')"
            >
              <template #icon><Trash2 :size="17" /></template>回收站
            </n-button>
            <n-button
              :type="presetsOpen ? 'primary' : 'default'"
              :secondary="presetsOpen"
              @click="presetsOpen = !presetsOpen"
            >
              <template #icon><SlidersHorizontal :size="17" /></template>播放预设与队列
            </n-button>
            <n-popover trigger="click" placement="bottom-start">
              <template #trigger
                ><n-button
                  ><template #icon><ArchiveRestore :size="17" /></template>备份恢复<ChevronDown :size="14" /></n-button
              ></template>
              <div class="library-backup-options">
                <n-button tag="a" :href="api.exportUrl()">导出完整备份</n-button>
                <n-button :loading="restoring" @click="backupInput?.click()">恢复备份</n-button>
                <router-link to="/tools/audio-convert"><n-button>音频转 MP3</n-button></router-link>
              </div>
            </n-popover>
            <div class="library-secondary-filters">
              <n-select :value="view" :options="views" aria-label="更多素材筛选" @update:value="chooseView" />
              <n-select v-model:value="language" clearable placeholder="全部语言" :options="languageOptions" />
              <n-select
                v-model:value="source"
                clearable
                placeholder="全部来源"
                :options="[
                  { label: '参考音色克隆', value: 'chatterbox' },
                  { label: '在线自然音色', value: 'edge-tts' },
                  { label: '本地上传', value: 'upload' },
                  { label: '裁剪音频', value: 'clip' }
                ]"
              />
              <n-select
                v-model:value="sort"
                :options="[
                  { label: '最新保存', value: 'createdAt' },
                  { label: '标题', value: 'title' },
                  { label: '时长', value: 'duration' }
                ]"
              />
              <n-button :loading="loading" @click="load"
                ><template #icon><RefreshCw :size="16" /></template>刷新</n-button
              >
            </div>
          </div>
          <div v-show="groupManagerOpen" class="library-group-manager">
            <header><strong>音频分组</strong><n-button size="small" @click="newGroup()">新建分组</n-button></header>
            <n-tree
              :data="tree"
              :selected-keys="groupId ? [groupId] : []"
              block-line
              default-expand-all
              @update:selected-keys="selectGroup"
            />
            <div v-if="groupId" class="library-group-controls">
              <n-button size="small" @click="editGroup">编辑分组</n-button
              ><n-button size="small" type="error" secondary @click="deleteGroup">删除分组</n-button>
            </div>
            <p class="library-storage">
              已存 {{ data?.totalItems || 0 }} 条 · {{ formatBytes(data?.usedBytes || 0) }} /
              {{ formatBytes(data?.maxBytes || 10 * 1024 ** 3) }}
            </p>
          </div>
        </section>
        <div v-show="presetsOpen" class="library-presets"><AudioQueuePanel ref="queuePanel" /></div>
        <section class="library-main">
          <div class="library-batch">
            <n-checkbox
              :checked="Boolean(data?.items.length && selected.length === data.items.length)"
              :indeterminate="Boolean(selected.length && selected.length !== data?.items.length)"
              @update:checked="selectAll"
              >全选本页</n-checkbox
            ><span>{{ selected.length }} 条已选</span
            ><n-button size="small" :disabled="!selected.length" @click="openMove(selected)">移动至</n-button
            ><n-button v-if="view !== 'trash'" size="small" :disabled="!selected.length" @click="enqueueSelected"
              >加入队列</n-button
            ><n-button
              v-if="view !== 'trash'"
              tag="a"
              size="small"
              :disabled="!selected.length"
              :href="selected.length ? api.exportUrl(selected) : undefined"
              >导出所选</n-button
            ><n-button
              size="small"
              :type="view === 'trash' ? 'primary' : 'error'"
              :secondary="view === 'trash'"
              :disabled="!selected.length || busy || purgingSelected || loading"
              @click="trashSelected"
              >{{ view === "trash" ? "恢复所选" : "移入回收站" }}</n-button
            ><n-button
              v-if="view === 'trash'"
              size="small"
              type="error"
              secondary
              :loading="purgingSelected"
              :disabled="!selected.length || busy || purgingSelected || loading"
              @click="purgeSelected"
              >彻底删除所选</n-button
            >
          </div>
          <div class="library-list-heading" aria-hidden="true">
            <span></span><span>音频名称</span><span>时长</span><span>素材类型</span><span>所属分组</span
            ><span>操作</span>
          </div>
          <n-spin :show="loading"
            ><div class="library-items" @play.capture="onItemPlay">
              <article
                v-for="item in data?.items || []"
                :key="item.id"
                class="library-item"
                :class="{ 'library-item--trash': view === 'trash' }"
              >
                <n-checkbox
                  :checked="selected.includes(item.id)"
                  :aria-label="`选择 ${item.title}`"
                  @update:checked="(checked) => toggleItem(item.id, checked)"
                />
                <div
                  class="library-item-copy"
                  role="button"
                  tabindex="0"
                  :aria-label="`查看 ${item.title} 详情`"
                  @click="openDetail(item)"
                  @keydown.enter="openDetail(item)"
                  @keydown.space.prevent="openDetail(item)"
                >
                  <span class="library-audio-icon" :class="{ 'is-speech': audioLibraryPurpose(item) === 'speech' }"
                    ><Mic v-if="audioLibraryPurpose(item) === 'speech'" :size="23" /><Music2 v-else :size="23"
                  /></span>
                  <header>
                    <strong>{{ item.title }}</strong
                    ><n-tag size="small">{{ languageLabel(item.language) }}</n-tag
                    ><n-tag v-if="!item.available" size="small" type="error">音频不可用</n-tag
                    ><n-tag v-if="audioLibraryPurpose(item) === 'music'" size="small">背景音乐</n-tag
                    ><n-tag
                      v-if="
                        audioLibraryPurpose(item) !== 'music' && (!item.foreignText.trim() || !item.chineseText.trim())
                      "
                      size="small"
                      type="warning"
                      >待补全</n-tag
                    >
                  </header>
                  <footer>
                    {{ formatDuration(item.duration) }} · {{ formatBytes(item.bytes) }} ·
                    {{ sourceLabel(item.source.kind) }} ·
                    {{ formatDate(item.createdAt) }}
                  </footer>
                </div>
                <span class="library-duration">{{ formatDuration(item.duration) }}</span>
                <span class="library-purpose"
                  ><n-tag size="small" :class="{ 'is-speech': audioLibraryPurpose(item) === 'speech' }">{{
                    purposeOptions.find((x) => x.value === audioLibraryPurpose(item))?.label || "通用音频"
                  }}</n-tag></span
                >
                <n-button
                  class="library-row-group"
                  size="small"
                  :disabled="view === 'trash'"
                  @click="openMove([item.id])"
                  >{{ groups.find((x) => x.value === item.groupId)?.label || "未分组" }}<ChevronDown :size="14"
                /></n-button>
                <details
                  v-if="view !== 'trash'"
                  :id="`library-preview-${item.id}`"
                  class="library-item-preview"
                  :open="previewIds.includes(item.id)"
                >
                  <summary><Play :size="14" />试听与裁剪<ChevronDown :size="14" /></summary>
                  <AudioLibraryItemPlayer :item="item" @saved="onClipSaved" />
                </details>
                <div class="library-item-actions">
                  <template v-if="view !== 'trash'">
                    <n-button
                      size="small"
                      class="library-preview-toggle"
                      :type="previewIds.includes(item.id) ? 'primary' : 'default'"
                      :secondary="previewIds.includes(item.id)"
                      :aria-expanded="previewIds.includes(item.id)"
                      :aria-controls="`library-preview-${item.id}`"
                      @click="
                        previewIds = previewIds.includes(item.id)
                          ? previewIds.filter((id) => id !== item.id)
                          : [...previewIds, item.id]
                      "
                    >
                      <template #icon><Play :size="14" /></template
                      >{{ previewIds.includes(item.id) ? "收起试听" : "试听与裁剪" }}
                    </n-button>
                    <n-button size="small" :disabled="!item.available" @click="enqueue([item])">＋队列</n-button
                    ><n-button
                      tag="a"
                      size="small"
                      :disabled="!item.available"
                      :href="item.available ? resolveBackendUrl(item.audioUrl) : undefined"
                      :download="item.title"
                      ><template #icon><Download :size="15" /></template>下载</n-button
                    ></template
                  ><template v-else
                    ><n-button size="small" type="primary" secondary @click="restoreItem(item)">恢复</n-button
                    ><n-button size="small" type="error" secondary @click="purge(item)">彻底删除</n-button></template
                  ><n-button size="small" :quaternary="view === 'trash'" @click="openDetail(item)">编辑</n-button>
                </div>
              </article>
              <n-empty
                v-if="!data?.items.length && !loading"
                description="暂无音频，可从参考音色克隆结果加入，或上传本地成品"
              /></div
          ></n-spin>
          <div v-if="data?.total" class="library-pagination">
            <span>共 {{ data.total }} 条</span
            ><n-pagination v-model:page="page" :page-size="20" :item-count="data.total" />
          </div>
        </section>
      </div>
      <n-drawer v-model:show="detailVisible" width="min(560px, 100vw)"
        ><n-drawer-content title="音频详情" closable
          ><template v-if="detail"
            ><n-form label-placement="top"
              ><n-form-item label="标题"><n-input v-model:value="draft.title" maxlength="120" /></n-form-item
              ><n-form-item label="用途"
                ><n-select v-model:value="draft.purpose" :options="purposeOptions" /></n-form-item
              ><n-form-item label="语言"
                ><n-select v-model:value="draft.language" filterable tag :options="languageOptions" /></n-form-item
              ><n-form-item label="外语文案"
                ><div class="library-detail-text-field">
                  <n-input
                    v-model:value="draft.foreignText"
                    type="textarea"
                    :autosize="{ minRows: 4, maxRows: 12 }"
                    maxlength="20000"
                  /><n-button text size="small" @click="copy(draft.foreignText || '')">复制外语</n-button>
                </div></n-form-item
              ><n-form-item label="中文译文"
                ><div class="library-detail-text-field">
                  <n-input
                    v-model:value="draft.chineseText"
                    type="textarea"
                    :autosize="{ minRows: 4, maxRows: 12 }"
                    maxlength="20000"
                  /><n-button text size="small" @click="copy(draft.chineseText || '')">复制中文</n-button>
                </div></n-form-item
              ><n-form-item label="备注"
                ><n-input v-model:value="draft.note" type="textarea" maxlength="2000" /></n-form-item></n-form
            ><n-alert type="info"
              >校对文案不会改变已保存的音频；如需改变朗读内容，请在配音模块重新生成后另行归档。</n-alert
            >
            <p class="library-source">
              来源：{{
                detail.source.kind === "chatterbox" || detail.source.kind === "edge-tts"
                  ? `${detail.source.kind === "chatterbox" ? "克隆批次" : "在线配音批次"} ${detail.source.batchId} · 第 ${detail.source.attempt} 次生成`
                  : detail.source.kind === "clip"
                    ? `裁剪自 ${detail.source.originalItemId} · ${detail.source.startSeconds?.toFixed(2)}–${detail.source.endSeconds?.toFixed(2)} 秒`
                    : detail.source.originalName
              }}<br />保存时间：{{ formatDate(detail.createdAt) }}
            </p>
            <details v-if="detail.source.originalText">
              <summary>原始生成文案快照</summary>
              <pre>{{ detail.source.originalText }}</pre>
              <pre>{{ detail.source.originalTranslation }}</pre>
            </details></template
          ><template #footer
            ><div class="library-detail-actions">
              <n-button type="primary" :loading="busy" @click="saveDetail">保存标注</n-button
              ><n-button v-if="detail && !detail.deletedAt" type="error" secondary @click="trashDetail"
                >移入回收站</n-button
              >
            </div></template
          ></n-drawer-content
        ></n-drawer
      >
      <n-modal v-model:show="moveVisible"
        ><n-card title="移动至分组" class="library-dialog" closable @close="moveVisible = false"
          ><p>{{ moveIds.length }} 条音频，只调整分类，不复制文件。</p>
          <div class="library-recent">
            <span>最近使用：</span
            ><n-button
              v-for="recent in recentOptions"
              :key="recent.value"
              size="tiny"
              @click="moveTarget = recent.value"
              >{{ recent.label }}</n-button
            >
          </div>
          <n-select v-model:value="moveTarget" clearable filterable placeholder="未分组" :options="groups" /><template
            #footer
            ><n-button type="primary" :loading="busy" @click="moveItems">确认移动</n-button></template
          ></n-card
        ></n-modal
      >
      <n-modal v-model:show="groupVisible"
        ><n-card
          :title="groupDraft.id ? '编辑分组' : '新建分组'"
          class="library-dialog"
          closable
          @close="groupVisible = false"
          ><n-form label-placement="top"
            ><n-form-item label="分组名称"><n-input v-model:value="groupDraft.name" maxlength="60" /></n-form-item
            ><n-form-item label="父分组（最多三级）"
              ><n-select
                v-model:value="groupDraft.parentId"
                clearable
                filterable
                :options="groups.filter((x) => x.value !== groupDraft.id)"
                placeholder="顶级分组" /></n-form-item></n-form
          ><template #footer
            ><n-button type="primary" :loading="busy" @click="saveGroup">保存分组</n-button></template
          ></n-card
        ></n-modal
      >
      <n-modal v-model:show="uploadVisible"
        ><n-card title="上传成品音频" class="library-upload-dialog" closable @close="uploadVisible = false"
          ><p>支持 MP3、PCM WAV、AAC M4A、FLAC，单个文件最大 100 MiB。</p>
          <p class="library-upload-hint">
            仅音频必填，其余信息均选填，可在入库后补充；标题留空使用文件名，语言留空为“未指定”。
          </p>
          <label
            class="file-upload-area"
            data-upload-area
            tabindex="0"
            :aria-disabled="uploading"
            @keydown.enter.prevent="!uploading && fileInput?.click()"
            @keydown.space.prevent="!uploading && fileInput?.click()"
          >
            <Upload :size="28" aria-hidden="true" /><strong>点击选择音频，可多选</strong>
            <span>MP3 / PCM WAV / AAC M4A / FLAC · 单个最大 100 MiB</span>
            <input
              ref="fileInput"
              hidden
              multiple
              type="file"
              :disabled="uploading"
              accept=".mp3,.wav,.m4a,.flac"
              @change="selectFiles"
            />
          </label>
          <div class="library-upload-list">
            <section v-for="(entry, index) in uploads" :key="index">
              <strong>{{ entry.file.name }} · {{ formatBytes(entry.file.size) }}</strong>
              <n-form
                label-placement="top"
                class="library-upload-meta"
                :disabled="uploading || (entry.done && !entry.duplicate)"
              >
                <n-form-item label="标题（选填）" class="library-upload-wide">
                  <n-input
                    v-model:value="entry.title"
                    maxlength="120"
                    :placeholder="`留空使用文件名：${entry.file.name.replace(/\.[^.]+$/, '')}`"
                  />
                </n-form-item>
                <n-form-item label="语言（选填）">
                  <n-select
                    v-model:value="entry.language"
                    clearable
                    filterable
                    tag
                    :options="languageOptions"
                    placeholder="未指定"
                  />
                </n-form-item>
                <n-form-item label="用途"
                  ><n-select v-model:value="entry.purpose" :options="purposeOptions"
                /></n-form-item>
                <n-form-item label="分组（选填）">
                  <n-select v-model:value="entry.groupId" clearable filterable :options="groups" placeholder="未分组" />
                </n-form-item>
                <n-form-item label="外语文案（选填）" class="library-upload-wide">
                  <n-input
                    v-model:value="entry.foreignText"
                    type="textarea"
                    maxlength="20000"
                    placeholder="可留空，之后补充"
                    :autosize="{ minRows: 2, maxRows: 5 }"
                  />
                </n-form-item>
                <n-form-item label="中文译文（选填）" class="library-upload-wide">
                  <n-input
                    v-model:value="entry.chineseText"
                    type="textarea"
                    maxlength="20000"
                    placeholder="可留空，之后补充"
                    :autosize="{ minRows: 2, maxRows: 5 }"
                  />
                </n-form-item>
                <n-form-item label="备注（选填）" class="library-upload-wide">
                  <n-input
                    v-model:value="entry.note"
                    type="textarea"
                    maxlength="2000"
                    placeholder="例如使用场景、播放提醒，可之后补充"
                    :autosize="{ minRows: 2, maxRows: 5 }"
                  />
                </n-form-item>
              </n-form>
              <p :class="{ 'library-upload-error': entry.failed }">
                {{ entry.message }}
              </p>
              <n-button v-if="entry.duplicate" size="small" :disabled="uploading" @click="uploadDuplicate(entry)"
                >仍然另存一条</n-button
              >
            </section>
          </div>
          <template #footer
            ><n-button type="primary" :loading="uploading" :disabled="!uploads.length" @click="uploadAll"
              >上传并入库 / 重试失败项</n-button
            ></template
          ></n-card
        ></n-modal
      >
    </section>
    <template #module-footer><AudioLibraryPlayer class="library-bottom-player" /></template>
  </ToolLayout>
</template>
<script setup lang="ts">
import { audioLibraryPurpose } from "@toolbox/shared";
import { useMessage } from "naive-ui";
import { ref } from "vue";
import {
  Search,
  Upload,
  FolderOpen,
  Trash2,
  SlidersHorizontal,
  ArchiveRestore,
  ChevronDown,
  RefreshCw,
  Music2,
  Mic,
  Play,
  Download
} from "lucide-vue-next";
import { resolveBackendUrl } from "../../shared/config/runtime";
const previewIds = ref<string[]>([]);
const groupManagerOpen = ref(false);
const presetsOpen = ref(false);
import {
  NPopover,
  NButton,
  NAlert,
  NCheckbox,
  NTree,
  NInput,
  NSelect,
  NTag,
  NEmpty,
  NSpin,
  NPagination,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NModal,
  NCard
} from "naive-ui";

import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import AudioQueuePanel from "./AudioQueuePanel.vue";
import AudioLibraryPlayer from "./AudioLibraryPlayer.vue";
import AudioLibraryItemPlayer from "./AudioLibraryItemPlayer.vue";
import { onItemPlay } from "./item-playback";
import { audioLibraryApi as api } from "./api";
import { formatBytes, formatDuration, formatDate, languageLabel, sourceLabel } from "./presentation";
import { useAudioLibraryCollection } from "./useAudioLibraryCollection";
import { useAudioLibraryItems } from "./useAudioLibraryItems";
import { useAudioLibraryGroups } from "./useAudioLibraryGroups";
import { useAudioLibraryTransfers } from "./useAudioLibraryTransfers";
const queuePanel = ref<InstanceType<typeof AudioQueuePanel>>();
const collection = useAudioLibraryCollection();
const purposeOptions = [
  { label: "通用音频", value: "general" },
  { label: "配音素材", value: "speech" },
  { label: "背景音乐", value: "music" }
];
const {
  data,
  loading,
  error,
  selected,
  views,
  view,
  groupId,
  keyword,
  language,
  source,
  sort,
  page,
  groups,
  tree,
  languageOptions,
  load,
  chooseView,
  selectGroup,
  selectAll,
  toggleItem
} = collection;
const {
  busy,
  purgingSelected,
  run,
  enqueue,
  enqueueSelected,
  detailVisible,
  detail,
  draft,
  openDetail,
  saveDetail,
  copy,
  trashSelected,
  trashDetail,
  restoreItem,
  purge,
  purgeSelected
} = useAudioLibraryItems(collection);
const {
  moveVisible,
  moveTarget,
  moveIds,
  recentOptions,
  openMove,
  undoToken,
  moveItems,
  undoMove,
  groupVisible,
  groupDraft,
  newGroup,
  editGroup,
  saveGroup,
  deleteGroup
} = useAudioLibraryGroups(collection, run);
const {
  uploadVisible,
  fileInput,
  uploads,
  uploading,
  selectFiles,
  uploadAll,
  uploadDuplicate,
  backupInput,
  restoring,
  restoreBackup
} = useAudioLibraryTransfers(collection, () => queuePanel.value?.refresh());
const message = useMessage();
async function onClipSaved() {
  message.success("已另存到同一分组，原音频和队列不变；请校对中外文案");
  await load();
}
</script>
<style scoped>
.library-page {
  grid-column: 1/-1;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  min-width: 0;
}
.library-workspace {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.library-toolbar {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.library-primary-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(210px, 0.65fr) auto;
  align-items: center;
  gap: 20px;
}
.library-purpose-filter,
.library-group-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.library-purpose-filter > span,
.library-group-filter > span {
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}
.library-group-filter :deep(.n-select) {
  min-width: 0;
  flex: 1;
}
.library-view-strip {
  display: flex;
  padding: 3px;
  background: var(--color-primary-50);
  border: 1px solid var(--color-border);
  border-radius: 9px;
}
.library-view {
  cursor: pointer;
  border: 0;
  border-radius: 6px;
  padding: 7px 12px;
  white-space: nowrap;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 13px;
}
.library-view.active {
  color: white;
  background: var(--color-primary-600);
  font-weight: 700;
  box-shadow: 0 2px 6px #6558ff26;
}
.library-upload-button {
  font-weight: 600;
}
.library-management {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
.library-secondary-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}
.library-secondary-filters :deep(.n-select) {
  width: 120px;
}
.library-backup-options {
  display: grid;
  gap: 8px;
}
.library-group-manager {
  margin-top: 16px;
  padding: 16px;
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-border);
  border-radius: 10px;
}
.library-group-manager header,
.library-group-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.library-group-manager header {
  justify-content: space-between;
}
.library-storage {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 0;
}
.library-main {
  min-width: 0;
}
.library-batch {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 18px;
  margin-bottom: 14px;
  border: 1px solid var(--color-primary-200);
  border-radius: 12px;
  background: linear-gradient(110deg, var(--color-primary-50), #e8e6ff);
  color: var(--color-primary-800);
  font-size: 13px;
}
.library-list-heading,
.library-item {
  display: grid;
  grid-template-columns: 22px minmax(180px, 1fr) 74px 104px minmax(100px, 140px) 330px;
  column-gap: 16px;
  align-items: center;
}
.library-list-heading {
  padding: 14px 20px;
  border: 1px solid var(--color-border);
  border-radius: 14px 14px 0 0;
  background: var(--color-surface-subtle);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}
.library-list-heading > :last-child {
  text-align: right;
}
.library-items {
  min-height: 160px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top: 0;
  border-radius: 0 0 14px 14px;
  overflow: hidden;
}
.library-item {
  position: relative;
  padding: 18px 20px;
  row-gap: 12px;
  border-bottom: 1px solid var(--color-border);
}
.library-item:last-of-type {
  border-bottom: 0;
}
.library-item:has(> .n-checkbox--checked) {
  background: var(--color-surface-subtle);
}
.library-item-copy {
  grid-column: 2;
  grid-row: 1;
  padding-left: 54px;
  position: relative;
  min-width: 0;
  cursor: pointer;
}
.library-audio-icon {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: white;
  border-radius: 11px;
  background: linear-gradient(145deg, #74e4ef, #2d9cf5);
  box-shadow: 0 3px 8px #2d9cf526;
}
.library-audio-icon.is-speech {
  background: linear-gradient(145deg, #a79bff, #6558ff);
}
.library-item-copy header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.library-item-copy strong {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--color-text);
}
.library-item-copy header :deep(.n-tag:not(.n-tag--error):not(.n-tag--warning)) {
  display: none;
}
.library-item-copy footer {
  margin-top: 5px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  line-height: 1.6;
}
.library-duration {
  grid-column: 3;
  grid-row: 1;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.library-purpose {
  grid-column: 4;
  grid-row: 1;
}
.library-purpose :deep(.n-tag) {
  color: var(--color-primary-600);
  background: var(--color-primary-50);
  border-radius: 6px;
}
.library-purpose :deep(.is-speech) {
  color: var(--color-local-700);
  background: var(--color-local-100);
}
.library-row-group {
  grid-column: 5;
  grid-row: 1;
  max-width: 100%;
}
.library-row-group :deep(.n-button__content) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  gap: 8px;
}
.library-item-actions {
  grid-column: 6;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 0;
}
.library-item-preview {
  grid-row: 2;
  grid-column: 1/-1;
  min-width: 0;
}
.library-item-preview > summary {
  display: none;
}
.library-item-preview:not([open]) {
  display: none;
}
.library-item-actions > :deep(.n-button) {
  border-radius: 8px;
  height: 32px;
  padding: 0 10px;
}
.library-item-actions > :deep(.n-button:not(.n-button--primary-type)) {
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.library-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 16px;
  color: var(--color-text-secondary);
  font-size: 13px;
}
.library-bottom-player {
  position: relative;
  bottom: auto;
  z-index: 5;
  margin: 0;
  border-color: var(--color-primary-200);
  background: var(--color-surface);
  box-shadow: 0 6px 24px #6558ff1a;
  border-radius: 16px 16px 0 0;
}
.library-bottom-player :deep(.library-player-heading strong) {
  color: var(--color-text);
}
.library-dialog {
  width: min(480px, calc(100vw - 32px));
}
.library-detail-text-field {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.library-detail-text-field > :deep(.n-button) {
  align-self: flex-end;
}
.library-detail-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.library-upload-dialog {
  width: min(720px, calc(100vw - 32px));
}
.library-dialog :deep(.n-card__content) > * + * {
  margin-top: 12px;
}
.library-upload-hint {
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}
.library-upload-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
}
.library-upload-meta > * {
  min-width: 0;
}
.library-upload-wide {
  grid-column: 1 / -1;
}
.library-upload-list {
  max-height: 55vh;
  overflow: auto;
}
.library-upload-list > section {
  padding: 18px 0;
  display: grid;
  gap: 10px;
  border-bottom: 1px solid var(--color-border);
}
.library-upload-error {
  color: #dc2626;
}
.library-source {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.library-recent {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
}

@container tool-content (max-width: 1350px) {
  .library-primary-filters {
    grid-template-columns: minmax(220px, 1fr) auto;
    gap: 14px;
  }
  .library-group-filter {
    grid-row: 2;
  }
  .library-upload-button {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
  }
  .library-secondary-filters {
    margin-left: 0;
  }
  .library-list-heading,
  .library-item {
    grid-template-columns: 22px minmax(160px, 1fr) 64px 90px 110px 330px;
    column-gap: 12px;
  }
}
@container tool-content (max-width: 1000px) {
  .library-list-heading {
    display: none;
  }
  .library-items {
    border-top: 1px solid var(--color-border);
    border-radius: 14px;
  }
  .library-item {
    grid-template-columns: 22px minmax(0, 1fr) auto;
  }
  .library-item-copy {
    grid-column: 2;
  }
  .library-duration {
    grid-column: 3;
  }
  .library-purpose {
    grid-column: 2;
    grid-row: 2;
    padding-left: 54px;
  }
  .library-row-group {
    grid-column: 3;
    grid-row: 2;
  }
  .library-item-actions {
    grid-column: 2/-1;
    grid-row: 3;
    justify-content: flex-start;
    padding: 0 0 0 54px;
  }
  .library-item-preview {
    grid-row: 4;
  }
}
@container tool-content (max-width: 650px) {
  .library-toolbar {
    padding: 14px;
  }
  .library-primary-filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .library-group-filter,
  .library-upload-button {
    grid-row: auto;
    grid-column: auto;
  }
  .library-upload-button {
    justify-self: stretch;
  }
  .library-purpose-filter {
    flex-wrap: wrap;
  }
  .library-secondary-filters {
    width: 100%;
  }
  .library-secondary-filters :deep(.n-select) {
    flex: 1 1 120px;
  }
  .library-item {
    padding: 14px 12px;
    column-gap: 10px;
  }
  .library-item-actions {
    padding-left: 0;
  }
  .library-item-copy {
    padding-left: 44px;
  }
  .library-audio-icon {
    width: 34px;
    height: 34px;
  }
  .library-purpose {
    padding-left: 44px;
  }
  .library-bottom-player {
    position: relative;
    bottom: auto;
  }
}
</style>
