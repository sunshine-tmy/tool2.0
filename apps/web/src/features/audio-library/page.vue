<template>
  <ToolLayout>
    <section class="main-column library-page">
      <ToolPageHeader
        title="直播音频库"
        description="永久保存直播音频与双语文案，按分组查找，随时加入播放队列。"
        kicker="LIVE AUDIO LIBRARY"
        ><template #actions
          ><n-button @click="uploadVisible = true">上传音频</n-button
          ><n-button tag="a" :href="api.exportUrl()">完整备份</n-button
          ><n-button :loading="restoring" @click="backupInput?.click()">恢复备份</n-button></template
        ></ToolPageHeader
      >
      <input ref="backupInput" hidden type="file" accept=".zip" @change="restoreBackup" />
      <AudioLibraryPlayer />
      <AudioQueuePanel ref="queuePanel" />
      <n-alert v-if="error" type="error" closable @close="error = ''"
        >{{ error }} <n-button text @click="load">重试</n-button></n-alert
      >
      <n-alert v-if="undoToken" type="success" closable @close="undoToken = ''"
        >已移动到目标分组。<n-button text @click="undoMove">撤销移动</n-button></n-alert
      >
      <div class="library-workspace">
        <aside class="workspace-panel library-sidebar">
          <div class="library-sidebar-heading">
            <strong>音频分组</strong><n-button size="tiny" @click="newGroup()">＋新建</n-button>
          </div>
          <button
            v-for="entry in views"
            :key="entry.value"
            class="library-view"
            :class="{ active: view === entry.value && !groupId }"
            @click="chooseView(entry.value)"
          >
            {{ entry.label }}
          </button>
          <n-tree
            :data="tree"
            :selected-keys="groupId ? [groupId] : []"
            block-line
            default-expand-all
            @update:selected-keys="selectGroup"
          />
          <div v-if="groupId" class="library-group-controls">
            <n-button size="tiny" @click="editGroup">编辑分组</n-button
            ><n-button size="tiny" type="error" @click="deleteGroup">删除分组</n-button>
          </div>
          <div class="library-storage">
            <strong
              >{{ formatBytes(data?.usedBytes || 0) }} / {{ formatBytes(data?.maxBytes || 10 * 1024 ** 3) }}</strong
            >
            <p>已存 {{ data?.totalItems || 0 }} 条 · 永久保留</p>
            <p>回收站计入占用；清理缓存会保留音频库。</p>
          </div>
        </aside>
        <section class="workspace-panel library-main">
          <div class="library-filters">
            <n-input v-model:value="keyword" clearable placeholder="搜索标题、外语、中文或备注" /><n-select
              v-model:value="language"
              clearable
              placeholder="全部语言"
              :options="languageOptions"
            /><n-select
              v-model:value="source"
              clearable
              placeholder="全部来源"
              :options="[
                { label: '参考音色克隆', value: 'chatterbox' },
                { label: '在线自然音色', value: 'edge-tts' },
                { label: '本地上传', value: 'upload' },
                { label: '裁剪音频', value: 'clip' }
              ]"
            /><n-select
              v-model:value="sort"
              :options="[
                { label: '最新保存', value: 'createdAt' },
                { label: '标题', value: 'title' },
                { label: '时长', value: 'duration' }
              ]"
            /><n-button :loading="loading" @click="load">刷新</n-button>
          </div>
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
                  <header>
                    <strong>{{ item.title }}</strong
                    ><n-tag size="small">{{ languageLabel(item.language) }}</n-tag
                    ><n-tag v-if="!item.available" size="small" type="error">音频不可用</n-tag
                    ><n-tag v-if="!item.foreignText.trim() || !item.chineseText.trim()" size="small" type="warning"
                      >待补全</n-tag
                    >
                  </header>
                  <p class="library-chinese">{{ item.chineseText || "暂无中文译文" }}</p>
                  <p class="library-foreign">{{ item.foreignText || "暂无外语文案" }}</p>
                  <footer>
                    {{ formatDuration(item.duration) }} · {{ formatBytes(item.bytes) }} ·
                    {{ sourceLabel(item.source.kind) }} · {{ formatDate(item.createdAt) }}
                  </footer>
                </div>
                <AudioLibraryItemPlayer v-if="view !== 'trash'" :item="item" @saved="onClipSaved" />
                <div class="library-item-actions">
                  <template v-if="view !== 'trash'"
                    ><n-button size="small" :disabled="!item.available" @click="enqueue([item])">＋队列</n-button
                    ><n-button size="small" @click="openMove([item.id])">移动至</n-button></template
                  ><template v-else
                    ><n-button size="small" type="primary" secondary @click="restoreItem(item)">恢复</n-button
                    ><n-button size="small" type="error" secondary @click="purge(item)">彻底删除</n-button></template
                  ><n-button size="small" :quaternary="view === 'trash'" @click="openDetail(item)">详情</n-button>
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
          <div class="library-upload-heading">
            <n-button :disabled="uploading" @click="fileInput?.click()">选择音频（必填，可多选）</n-button
            ><input ref="fileInput" hidden multiple type="file" accept=".mp3,.wav,.m4a,.flac" @change="selectFiles" />
          </div>
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
              <p :class="{ 'library-upload-error': entry.failed }">{{ entry.message }}</p>
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
  </ToolLayout>
</template>
<script setup lang="ts">
import { useMessage } from "naive-ui";
import { ref } from "vue";
import {
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
  grid-column: 1 / -1;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
}
.library-workspace {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 18px;
  margin-top: 20px;
}
.library-sidebar,
.library-main {
  margin-top: 0;
  padding: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  min-width: 0;
}
.library-sidebar-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.library-view {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 10px 12px;
  color: #475569;
  cursor: pointer;
}
.library-view.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}
.library-group-controls {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.library-storage {
  border-top: 1px solid #e2e8f0;
  margin-top: 24px;
  padding-top: 16px;
  color: #64748b;
  font-size: 12px;
}
.library-storage p {
  margin: 6px 0;
}
.library-filters {
  display: grid;
  grid-template-columns: minmax(180px, 2fr) repeat(3, minmax(90px, 1fr)) auto;
  gap: 8px;
}
.library-batch {
  display: flex;
  gap: 9px;
  align-items: center;
  flex-wrap: wrap;
  padding: 16px 0;
  font-size: 12px;
  color: #64748b;
}
.library-items {
  min-height: 180px;
}
.library-item {
  display: grid;
  grid-template-columns: 18px minmax(200px, 1fr) minmax(300px, 1.25fr) 104px;
  gap: 16px;
  align-items: flex-start;
  border-top: 1px solid #edf1f7;
  padding: 18px 0;
}
.library-item--trash {
  grid-template-columns: 18px minmax(0, 1fr) auto;
}
.library-item-copy {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.library-item-copy header {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.library-item-copy p {
  margin: 8px 0;
  white-space: pre-wrap;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}
.library-chinese {
  color: #172033;
}
.library-foreign {
  color: #64748b;
  font-size: 13px;
}
.library-item-copy footer {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #94a3b8;
}
.library-item-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding-left: 8px;
}
.library-item-actions > :deep(.n-button) {
  width: 100%;
}
.library-item--trash .library-item-actions {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  align-self: center;
  justify-content: flex-end;
  gap: 8px;
}
.library-item--trash .library-item-actions > :deep(.n-button) {
  width: auto;
  min-width: 60px;
}
.library-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
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
.library-upload-heading {
  display: flex;
  gap: 12px;
}
.library-upload-hint {
  font-size: 12px;
  line-height: 1.7;
  color: #64748b;
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
  border-bottom: 1px solid #e2e8f0;
}
.library-upload-error {
  color: #dc2626;
}
.library-source {
  font-size: 12px;
  color: #64748b;
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
@media (max-width: 1200px) {
  .library-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .library-workspace {
    grid-template-columns: 190px minmax(0, 1fr);
  }
}
.library-main {
  container-type: inline-size;
}
@container (max-width: 820px) {
  .library-item {
    grid-template-columns: 18px minmax(0, 1fr) 104px;
  }
  .library-item > .library-item-player {
    grid-column: 2 / -1;
    grid-row: 2;
  }
  .library-item-actions {
    grid-column: 3;
    grid-row: 1;
  }
}
@container (max-width: 460px) {
  .library-item {
    grid-template-columns: 18px minmax(0, 1fr);
  }
  .library-item-actions {
    grid-column: 2;
    grid-row: 3;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 8px;
    padding-left: 0;
  }
  .library-item-actions > :deep(.n-button) {
    width: auto;
    min-width: 76px;
  }
  .library-item--trash .library-item-actions {
    grid-row: 2;
    justify-content: flex-start;
    padding-left: 0;
  }
}
@media (max-width: 760px) {
  .library-workspace {
    grid-template-columns: 1fr;
  }
  .library-sidebar {
    max-height: 300px;
    overflow: auto;
  }
  .library-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .library-storage {
    display: none;
  }
}
</style>
