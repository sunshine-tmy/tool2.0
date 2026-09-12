<template>
  <ToolLayout>
    <section class="main-column lan-main">
      <ToolPageHeader
        title="局域网文件传输"
        description="同一局域网内收发文件和图文便签，支持复制、预览、筛选、下载和删除。"
        kicker="LOCAL FILE SHARING"
      >
        <template #actions>
          <n-button secondary @click="refreshLanTransfer">
            <template #icon>
              <RefreshCw :size="16" />
            </template>
            刷新列表
          </n-button>
        </template>
      </ToolPageHeader>

      <section class="workspace-panel lan-panel">
        <div class="lan-share-card">
          <div class="share-strip">
            <div class="share-address">
              <span>局域网访问地址</span>
              <strong>{{ selectedShareUrl }}</strong>
              <n-select
                v-if="shareUrlOptions.length > 1"
                v-model:value="selectedShareUrl"
                size="small"
                :options="shareUrlOptions"
                aria-label="选择局域网访问地址"
              />
            </div>
            <div class="share-actions">
              <img v-if="shareQrCode" :src="shareQrCode" alt="局域网访问地址二维码" class="share-qr" />
              <n-button secondary @click="copyText(selectedShareUrl)">复制地址</n-button>
            </div>
          </div>
          <div v-if="lanInfo" class="lan-capacity">
            已使用 {{ formatBytes(lanInfo.usedBytes) }}，上传预留 {{ formatBytes(lanInfo.reservedUploadBytes) }}，
            总配额 {{ formatBytes(lanInfo.maxStorageBytes) }}
          </div>
        </div>

        <div v-if="lanInfo?.pinRequired && !lanInfo.authenticated" class="lan-access-strip">
          <div>
            <strong>当前为访客模式</strong>
            <span>{{ guestModeDescription }}</span>
          </div>
          <n-input
            v-model:value="accessPin"
            type="password"
            show-password-on="click"
            placeholder="输入管理 PIN"
            aria-label="管理 PIN"
            @keyup.enter="unlockLanTransfer"
          />
          <n-button type="primary" :loading="unlocking" @click="unlockLanTransfer">解锁管理</n-button>
        </div>

        <div v-if="pendingUploads.length" class="resume-strip">
          <div>
            <strong>有 {{ pendingUploads.length }} 个未完成上传</strong>
            <span>重新选择同一个原文件即可从服务器已接收的分片继续。</span>
          </div>
          <n-button size="small" tertiary @click="clearPendingUploadRecords">清除失效记录</n-button>
        </div>

        <n-tabs v-model:value="activeLanTab" class="lan-workspace-tabs" type="line" animated>
          <n-tab-pane name="files" tab="文件传输" display-directive="show">
            <label
              v-if="canUploadFiles"
              class="dropzone lan-dropzone"
              :class="{ 'is-dragging': isDraggingFiles }"
              tabindex="0"
              @keydown.enter.prevent="lanFileInput?.click()"
              @keydown.space.prevent="lanFileInput?.click()"
              @dragenter.prevent="isDraggingFiles = true"
              @dragover.prevent="isDraggingFiles = true"
              @dragleave.prevent="isDraggingFiles = false"
              @drop.prevent="onLanFilesDrop"
            >
              <input ref="lanFileInput" hidden multiple type="file" @change="onLanFilesChange" />
              <UploadCloud :size="28" />
              <span>点击选择、拖拽或粘贴文件，支持图片、视频、音频、文本、PDF、压缩包和文档</span>
              <small
                >在此页面按 Ctrl+V（macOS 按 Command+V）即可上传 · 单文件上限
                {{ formatBytes(lanInfo?.maxFileBytes ?? 20 * 1024 ** 3) }}，默认保留
                {{ lanInfo?.retentionDays ?? 3 }} 天</small
              >
            </label>

            <div v-if="uploadQueue.length" class="upload-list">
              <div v-for="item in uploadQueue" :key="item.id" class="task-row">
                <strong>{{ item.name }} · {{ formatBytes(item.size) }}</strong>
                <n-progress
                  type="line"
                  :percentage="item.progress"
                  :status="item.status === 'failed' ? 'error' : item.status === 'done' ? 'success' : 'default'"
                  indicator-placement="inside"
                />
                <div class="upload-actions">
                  <n-button v-if="item.status === 'uploading'" tertiary size="small" @click="item.uploader?.pause()"
                    >暂停</n-button
                  >
                  <n-button
                    v-if="item.status === 'paused' || item.status === 'failed'"
                    secondary
                    size="small"
                    @click="item.uploader?.resume()"
                    >继续</n-button
                  >
                  <n-button
                    v-if="item.status === 'uploading' || item.status === 'paused' || item.status === 'failed'"
                    tertiary
                    size="small"
                    type="error"
                    @click="item.uploader?.cancel()"
                  >
                    取消
                  </n-button>
                </div>
              </div>
            </div>
          </n-tab-pane>

          <n-tab-pane name="notes" tab="图文快传" display-directive="show">
            <section class="lan-note-section">
              <div class="lan-note-heading">
                <div>
                  <h3>图文快传</h3>
                  <p>发送文字、链接、验证码或图文内容，局域网内其他设备可直接复制和查看。</p>
                </div>
                <span v-if="lanInfo">{{ lanInfo.noteCount ?? 0 }} 条 · 默认保留 {{ lanInfo.retentionDays }} 天</span>
              </div>

              <div v-if="canUploadFiles" class="lan-note-composer" @paste="onNotePaste">
                <n-input
                  v-model:value="noteTitle"
                  clearable
                  :maxlength="lanNoteLimits.titleCharacters"
                  placeholder="标题（可选）"
                />
                <n-input
                  v-model:value="noteContent"
                  type="textarea"
                  :autosize="{ minRows: 3, maxRows: 10 }"
                  :maxlength="lanNoteLimits.contentCharacters"
                  show-count
                  placeholder="输入要传输的文字、链接、地址或说明……"
                />
                <div class="lan-note-picker">
                  <input
                    ref="noteImageInput"
                    hidden
                    multiple
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                    @change="onNoteImagesChange"
                  />
                  <n-button
                    secondary
                    :disabled="noteImages.length >= lanNoteLimits.maxImages"
                    @click="noteImageInput?.click()"
                  >
                    添加图片 {{ noteImages.length }}/{{ lanNoteLimits.maxImages }}
                  </n-button>
                  <span>单张不超过 10 MB，合计不超过 30 MB；支持直接粘贴剪贴板截图</span>
                </div>
                <div v-if="noteImages.length" class="lan-note-draft-images">
                  <figure v-for="(image, index) in noteImages" :key="image.id">
                    <img :src="image.previewUrl" :alt="image.file.name" />
                    <figcaption>
                      <span>{{ image.file.name }}</span>
                      <n-button tertiary size="tiny" type="error" @click="removeNoteImage(index)">移除</n-button>
                    </figcaption>
                  </figure>
                </div>
                <div class="lan-note-publish-actions">
                  <span
                    >{{ noteContent.length.toLocaleString() }} /
                    {{ lanNoteLimits.contentCharacters.toLocaleString() }} 字</span
                  >
                  <n-button type="primary" :loading="publishingNote" @click="publishNote">发布图文</n-button>
                </div>
              </div>

              <div v-if="canManageFiles" class="batch-toolbar lan-note-batch-toolbar">
                <n-checkbox
                  :checked="lanNotePageSelection.checked"
                  :indeterminate="lanNotePageSelection.indeterminate"
                  :disabled="!lanNotes.length"
                  @update:checked="toggleAllLanNotes"
                >
                  全选本页
                </n-checkbox>
                <n-button
                  tertiary
                  type="error"
                  size="small"
                  :disabled="!selectedLanNoteIds.length"
                  :loading="batchDeletingLanNotes"
                  @click="deleteSelectedLanNotes"
                >
                  批量删除 {{ selectedLanNoteIds.length || "" }}
                </n-button>
              </div>

              <div v-if="canReadFiles" class="lan-note-list">
                <article v-for="note in lanNotes" :key="note.id" class="lan-note-card">
                  <header>
                    <div class="lan-note-card-main">
                      <n-checkbox
                        v-if="canManageFiles"
                        :checked="selectedLanNoteIds.includes(note.id)"
                        :aria-label="`选择 ${note.title || '图文快传'}`"
                        @update:checked="(checked) => toggleLanNote(note.id, checked)"
                      />
                      <div>
                        <strong>{{ note.title || "图文快传" }}</strong>
                        <span>发布 {{ formatDate(note.createdAt) }} · 过期 {{ formatDate(note.expiresAt) }}</span>
                      </div>
                    </div>
                    <div class="lan-note-actions">
                      <n-button v-if="note.content" secondary size="small" @click="copyNoteContent(note)"
                        >复制文字</n-button
                      >
                      <n-button v-if="canManageFiles" tertiary size="small" @click="extendNoteExpiry(note)"
                        >保留30天</n-button
                      >
                      <n-button v-if="canManageFiles" tertiary size="small" type="error" @click="deleteLanNote(note)"
                        >删除</n-button
                      >
                    </div>
                  </header>
                  <pre v-if="note.content">{{ note.content }}</pre>
                  <div v-if="note.images.length" class="lan-note-images">
                    <figure v-for="image in note.images" :key="image.id">
                      <a :href="image.previewUrl" target="_blank" rel="noreferrer">
                        <img :src="image.previewUrl" :alt="image.originalName" loading="lazy" decoding="async" />
                      </a>
                      <figcaption>
                        <span>{{ image.originalName }} · {{ formatBytes(image.size) }}</span>
                        <span>
                          <a :href="image.downloadUrl">下载</a>
                          <n-button text type="primary" size="tiny" @click="copyNoteImageLink(image.previewUrl)">
                            复制链接
                          </n-button>
                        </span>
                      </figcaption>
                    </figure>
                  </div>
                </article>
                <n-empty v-if="!lanNotes.length" description="暂无图文，发送一段文字或几张图片试试" />
                <div v-if="shouldShowPagination(notePagination.total)" class="pagination-row">
                  <span class="pagination-total">共 {{ notePagination.total }} 条图文</span>
                  <n-pagination
                    v-model:page="notePagination.page"
                    v-model:page-size="notePagination.pageSize"
                    :item-count="notePagination.total"
                    :page-sizes="[10, 20, 50, 100]"
                    show-size-picker
                    @update:page="refreshLanNotes"
                    @update:page-size="onNotePageSizeChange"
                  />
                </div>
              </div>
            </section>
          </n-tab-pane>
        </n-tabs>

        <div v-show="activeLanTab === 'files'" class="lan-files-workspace">
          <div v-if="canReadFiles" class="lan-filters">
            <n-input
              v-model:value="lanQuery.keyword"
              clearable
              placeholder="搜索文件名或扩展名"
              @keyup.enter="applyLanFilters"
            />
            <n-select
              v-model:value="lanQuery.category"
              clearable
              :options="lanCategoryOptions"
              placeholder="文件类型"
            />
            <n-input v-model:value="lanQuery.extension" clearable placeholder="扩展名，例如 pdf" />
            <n-select v-model:value="lanQuery.sortBy" :options="lanSortOptions" />
            <n-select v-model:value="lanQuery.sortOrder" :options="lanSortOrderOptions" />
            <n-button type="primary" @click="applyLanFilters">筛选</n-button>
            <n-button secondary @click="resetLanFilters">重置</n-button>
          </div>

          <div v-if="canReadFiles" class="batch-toolbar">
            <n-checkbox
              :checked="lanPageSelection.checked"
              :indeterminate="lanPageSelection.indeterminate"
              :disabled="!lanFiles.length"
              @update:checked="toggleAllLanFiles"
            >
              全选本页
            </n-checkbox>
            <div class="batch-actions">
              <n-button
                secondary
                size="small"
                :disabled="!selectedLanFileIds.length"
                :loading="batchDownloadingLanFiles"
                @click="downloadSelectedLanFiles"
                >批量下载 {{ selectedLanFileIds.length || "" }}</n-button
              >
              <n-button
                v-if="canManageFiles"
                tertiary
                type="error"
                size="small"
                :disabled="!selectedLanFileIds.length"
                :loading="batchDeletingLanFiles"
                @click="deleteSelectedLanFiles"
                >批量删除 {{ selectedLanFileIds.length || "" }}</n-button
              >
            </div>
          </div>

          <div v-if="canReadFiles" class="file-list">
            <article v-for="file in lanFiles" :key="file.id" class="file-row">
              <div class="file-main">
                <n-checkbox
                  :checked="selectedLanFileIds.includes(file.id)"
                  :aria-label="`选择 ${file.originalName}`"
                  @update:checked="(checked) => toggleLanFile(file.id, checked)"
                />
                <FileArchive v-if="file.category === 'archive'" :size="20" />
                <FileVideo v-else-if="file.category === 'video'" :size="20" />
                <ImageDown v-else-if="file.category === 'image'" :size="20" />
                <Music v-else-if="file.category === 'audio'" :size="20" />
                <FileText v-else :size="20" />
                <div>
                  <strong>{{ file.originalName }}</strong>
                  <span
                    >{{ categoryName(file.category) }} · {{ formatBytes(file.size) }} ·
                    {{ file.extension || "无扩展名" }}</span
                  >
                </div>
              </div>
              <div class="file-meta">
                <span>上传 {{ formatDate(file.createdAt) }}</span>
                <span>过期 {{ formatDate(file.expiresAt) }}</span>
                <span>下载 {{ file.downloadCount }}</span>
              </div>
              <div class="file-actions">
                <n-button
                  secondary
                  size="small"
                  :disabled="!file.previewable"
                  :aria-label="`预览 ${file.originalName}`"
                  @click="openPreview(file)"
                  >预览</n-button
                >
                <n-button
                  secondary
                  size="small"
                  tag="a"
                  :href="file.downloadUrl"
                  :aria-label="`下载 ${file.originalName}`"
                  >下载</n-button
                >
                <n-button
                  tertiary
                  size="small"
                  :aria-label="`复制 ${file.originalName} 的下载链接`"
                  @click="copyFileLink(file)"
                  >复制链接</n-button
                >
                <n-button
                  v-if="canManageFiles"
                  tertiary
                  size="small"
                  :aria-label="`将 ${file.originalName} 保留 30 天`"
                  @click="extendFileExpiry(file)"
                  >保留30天</n-button
                >
                <n-button
                  v-if="canManageFiles"
                  tertiary
                  size="small"
                  type="error"
                  :aria-label="`删除 ${file.originalName}`"
                  @click="deleteLanFile(file)"
                  >删除</n-button
                >
              </div>
            </article>
            <n-empty v-if="!lanFiles.length" description="暂无文件" />
          </div>
          <div v-if="canReadFiles && shouldShowPagination(lanPagination.total)" class="pagination-row">
            <span class="pagination-total">共 {{ lanPagination.total }} 个文件</span>
            <n-pagination
              v-model:page="lanPagination.page"
              v-model:page-size="lanPagination.pageSize"
              :item-count="lanPagination.total"
              :page-sizes="[10, 20, 50, 100]"
              show-size-picker
              @update:page="refreshLanFiles"
              @update:page-size="onLanPageSizeChange"
            />
          </div>
        </div>
      </section>
    </section>

    <n-modal v-model:show="previewVisible" preset="card" :title="previewFile?.originalName" class="preview-modal">
      <div v-if="previewFile" class="preview-body">
        <img
          v-if="previewFile.category === 'image'"
          :src="previewFile.previewUrl"
          :alt="previewFile.originalName"
          decoding="async"
        />
        <video v-else-if="previewFile.category === 'video'" :src="previewFile.previewUrl" controls />
        <audio v-else-if="previewFile.category === 'audio'" :src="previewFile.previewUrl" controls />
        <iframe
          v-else-if="previewFile.category === 'pdf'"
          :src="previewFile.previewUrl"
          sandbox=""
          title="PDF preview"
        />
        <pre v-else-if="previewFile.category === 'text'">{{ previewText }}</pre>
        <n-empty v-else description="该文件类型不支持预览，请下载查看。" />
      </div>
      <template #footer>
        <n-button type="primary" tag="a" :href="previewFile?.downloadUrl" target="_blank">下载文件</n-button>
      </template>
    </n-modal>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import {
  NButton,
  NCheckbox,
  NEmpty,
  NInput,
  NModal,
  NPagination,
  NProgress,
  NSelect,
  NTabPane,
  NTabs,
  useMessage
} from "naive-ui";
import type { LanFileCategory, LanFileSortBy, LanFileSortOrder } from "@toolbox/shared";
import { lanFileCategories, lanNoteLimits } from "@toolbox/shared";
import { FileArchive, FileText, FileVideo, ImageDown, Music, RefreshCw, UploadCloud } from "lucide-vue-next";
import QRCode from "qrcode";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { currentWebUrl } from "../../config/runtime";
import { copyTextToClipboard } from "../../utils/clipboard";
import { ConcurrentChunkUploader } from "./chunk-uploader";
import { lanTransferApi } from "./api";
import { shouldShowPagination } from "./pagination";
import { filesFromClipboard, isEditablePasteTarget } from "./paste-upload";
import type { LanFileView, LanNoteView, LanTransferInfo, PendingLanUpload, UploadItem } from "./types";
import { removeUploadItem } from "./upload-queue";
import {
  clearPendingUploads,
  findPendingUpload,
  listPendingUploads,
  removePendingUpload,
  savePendingUpload
} from "./upload-resume";
import {
  getPageSelectionState,
  pruneSelectedIds,
  togglePageSelection,
  toggleSelectedId
} from "../../utils/batch-selection";

const message = useMessage();
const confirmAction = useConfirmDialog();
const activeLanTab = ref<"files" | "notes">("files");
const currentTransferUrl = new URL("/tools/lan-transfer", currentWebUrl()).toString();
const lanInfo = ref<LanTransferInfo | null>(null);
const selectedShareUrl = ref(currentTransferUrl);
const shareQrCode = ref("");
const accessPin = ref("");
const unlocking = ref(false);
const pendingUploads = ref<PendingLanUpload[]>(listPendingUploads());
const lanFileInput = ref<HTMLInputElement | null>(null);
const lanFiles = ref<LanFileView[]>([]);
const uploadQueue = ref<UploadItem[]>([]);
const isDraggingFiles = ref(false);
const previewVisible = ref(false);
const previewFile = ref<LanFileView | null>(null);
const previewText = ref("");
const selectedLanFileIds = ref<string[]>([]);
const batchDeletingLanFiles = ref(false);
const batchDownloadingLanFiles = ref(false);
const noteTitle = ref("");
const noteContent = ref("");
const noteImageInput = ref<HTMLInputElement | null>(null);
const noteImages = ref<Array<{ id: string; file: File; previewUrl: string }>>([]);
const publishingNote = ref(false);
const lanNotes = ref<LanNoteView[]>([]);
const selectedLanNoteIds = ref<string[]>([]);
const batchDeletingLanNotes = ref(false);
const notePagination = reactive({ page: 1, pageSize: 20, total: 0, pageCount: 1 });
const lanQuery = reactive({
  keyword: "",
  category: undefined as LanFileCategory | undefined,
  extension: "",
  sortBy: "createdAt" as LanFileSortBy,
  sortOrder: "desc" as LanFileSortOrder
});
const lanPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  pageCount: 1
});

const lanCategoryOptions = lanFileCategories.map((category) => ({
  label: categoryName(category),
  value: category
}));
const lanSortOptions = [
  { label: "上传时间", value: "createdAt" },
  { label: "文件大小", value: "size" },
  { label: "文件名", value: "name" },
  { label: "下载次数", value: "downloadCount" }
];
const lanSortOrderOptions = [
  { label: "降序", value: "desc" },
  { label: "升序", value: "asc" }
];
const lanPageFileIds = computed(() => lanFiles.value.map((file) => file.id));
const lanPageSelection = computed(() => getPageSelectionState(selectedLanFileIds.value, lanPageFileIds.value));
const lanNotePageIds = computed(() => lanNotes.value.map((note) => note.id));
const lanNotePageSelection = computed(() => getPageSelectionState(selectedLanNoteIds.value, lanNotePageIds.value));
const shareUrlOptions = computed(() =>
  Array.from(new Set([...(lanInfo.value?.lanUrls ?? []), currentTransferUrl])).map((url) => ({
    label: url,
    value: url
  }))
);
const guestModeDescription = computed(() => {
  const descriptions: Record<NonNullable<LanTransferInfo>["guestMode"], string> = {
    full: "访客可以上传、查看和管理文件及图文",
    "upload-only": "访客仅可上传文件和发布图文",
    "download-only": "访客仅可查看和下载文件及图文",
    disabled: "访客无访问权限"
  };
  return lanInfo.value ? descriptions[lanInfo.value.guestMode] : "";
});
const hasFullAccess = computed(
  () => !lanInfo.value?.pinRequired || lanInfo.value.authenticated || lanInfo.value.guestMode === "full"
);
const canReadFiles = computed(() => hasFullAccess.value || lanInfo.value?.guestMode === "download-only");
const canUploadFiles = computed(() => hasFullAccess.value || lanInfo.value?.guestMode === "upload-only");
const canManageFiles = computed(() => hasFullAccess.value);

watch(
  selectedShareUrl,
  async (url) => {
    try {
      shareQrCode.value = await QRCode.toDataURL(url, { width: 180, margin: 1, errorCorrectionLevel: "M" });
    } catch {
      shareQrCode.value = "";
    }
  },
  { immediate: true }
);

onMounted(async () => {
  document.addEventListener("paste", onLanFilesPaste);
  await refreshLanInfo();
  await Promise.all([refreshLanFiles(), refreshLanNotes()]);
});

onUnmounted(() => {
  document.removeEventListener("paste", onLanFilesPaste);
  clearNoteImages();
});

async function refreshLanInfo() {
  try {
    lanInfo.value = await lanTransferApi.getInfo();
    const currentHost = typeof window === "undefined" ? "" : window.location.hostname;
    if ((currentHost === "127.0.0.1" || currentHost === "localhost") && lanInfo.value.lanUrls[0]) {
      selectedShareUrl.value = lanInfo.value.lanUrls[0];
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取传输服务信息失败");
  }
}

async function refreshLanTransfer() {
  await refreshLanInfo();
  await Promise.all([refreshLanFiles(), refreshLanNotes()]);
}

async function refreshLanNotes() {
  if (!canReadFiles.value) {
    lanNotes.value = [];
    notePagination.total = 0;
    return;
  }
  try {
    const result = await lanTransferApi.listNotes(notePagination.page, notePagination.pageSize);
    lanNotes.value = result.notes;
    notePagination.page = result.pagination.page;
    notePagination.pageSize = result.pagination.pageSize;
    notePagination.total = result.pagination.total;
    notePagination.pageCount = result.pagination.pageCount;
    selectedLanNoteIds.value = pruneSelectedIds(selectedLanNoteIds.value, lanNotePageIds.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取图文列表失败");
  }
}

async function unlockLanTransfer() {
  if (!accessPin.value) return;
  unlocking.value = true;
  try {
    await lanTransferApi.unlock(accessPin.value);
    accessPin.value = "";
    await refreshLanInfo();
    await Promise.all([refreshLanFiles(), refreshLanNotes()]);
    message.success("管理权限已解锁");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "访问 PIN 不正确");
  } finally {
    unlocking.value = false;
  }
}

function onNoteImagesChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = Array.from(input.files ?? []);
  input.value = "";
  addNoteImages(selected);
}

function onNotePaste(event: ClipboardEvent) {
  const images = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
  if (!images.length) return;
  addNoteImages(images);
  message.success(images.length > 1 ? `已粘贴 ${images.length} 张图片` : "已粘贴剪贴板图片");
}

function addNoteImages(selected: File[]) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);
  let totalBytes = noteImages.value.reduce((total, image) => total + image.file.size, 0);
  for (const file of selected) {
    if (noteImages.value.length >= lanNoteLimits.maxImages) {
      message.warning(`每条图文最多添加 ${lanNoteLimits.maxImages} 张图片`);
      break;
    }
    if (!allowedTypes.has(file.type)) {
      message.warning(`${file.name} 不是受支持的图片格式`);
      continue;
    }
    if (file.size > lanNoteLimits.maxImageBytes) {
      message.warning(`${file.name} 超过 10 MB`);
      continue;
    }
    if (totalBytes + file.size > lanNoteLimits.maxTotalImageBytes) {
      message.warning("图片总大小不能超过 30 MB");
      break;
    }
    const duplicate = noteImages.value.some(
      (image) =>
        image.file.name === file.name && image.file.size === file.size && image.file.lastModified === file.lastModified
    );
    if (duplicate) continue;
    noteImages.value.push({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      previewUrl: URL.createObjectURL(file)
    });
    totalBytes += file.size;
  }
}

function removeNoteImage(index: number) {
  const [removed] = noteImages.value.splice(index, 1);
  if (removed) URL.revokeObjectURL(removed.previewUrl);
}

function clearNoteImages() {
  noteImages.value.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  noteImages.value = [];
}

async function publishNote() {
  const content = noteContent.value.trim();
  if (!content && !noteImages.value.length) {
    message.warning("请输入文字或至少选择一张图片");
    return;
  }
  publishingNote.value = true;
  try {
    await lanTransferApi.createNote({
      title: noteTitle.value.trim(),
      content,
      images: noteImages.value.map((image) => image.file)
    });
    noteTitle.value = "";
    noteContent.value = "";
    clearNoteImages();
    notePagination.page = 1;
    await Promise.all([refreshLanInfo(), refreshLanNotes()]);
    message.success("图文已发送到局域网");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "发布图文失败");
  } finally {
    publishingNote.value = false;
  }
}

async function copyNoteContent(note: LanNoteView) {
  await copyText(note.content);
}

async function copyNoteImageLink(previewUrl: string) {
  await copyText(new URL(previewUrl, currentWebUrl()).toString());
}

async function extendNoteExpiry(note: LanNoteView) {
  try {
    await lanTransferApi.updateNoteExpiry(note.id, 30);
    await refreshLanNotes();
    message.success("图文已延长保留 30 天");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "更新图文有效期失败");
  }
}

async function deleteLanNote(note: LanNoteView) {
  if (!(await confirmAction(`删除“${note.title || "图文快传"}”？`, { title: "删除图文" }))) return;
  try {
    await lanTransferApi.deleteNote(note.id);
    if (lanNotes.value.length === 1 && notePagination.page > 1) notePagination.page -= 1;
    await Promise.all([refreshLanInfo(), refreshLanNotes()]);
    message.success("图文已删除");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "删除图文失败");
  }
}

function toggleLanNote(id: string, checked: boolean) {
  selectedLanNoteIds.value = toggleSelectedId(selectedLanNoteIds.value, id, checked);
}

function toggleAllLanNotes(checked: boolean) {
  selectedLanNoteIds.value = togglePageSelection(selectedLanNoteIds.value, lanNotePageIds.value, checked);
}

async function deleteSelectedLanNotes() {
  if (!selectedLanNoteIds.value.length) return;
  if (
    !(await confirmAction(`删除选中的 ${selectedLanNoteIds.value.length} 条图文？`, {
      title: "批量删除图文"
    }))
  ) {
    return;
  }

  batchDeletingLanNotes.value = true;
  try {
    const ids = [...selectedLanNoteIds.value];
    await lanTransferApi.deleteNotes(ids);
    selectedLanNoteIds.value = [];
    if (lanNotes.value.length === ids.length && notePagination.page > 1) notePagination.page -= 1;
    await Promise.all([refreshLanInfo(), refreshLanNotes()]);
    message.success("已批量删除图文");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "批量删除图文失败");
  } finally {
    batchDeletingLanNotes.value = false;
  }
}

async function onNotePageSizeChange(pageSize: number) {
  notePagination.page = 1;
  notePagination.pageSize = pageSize;
  await refreshLanNotes();
}

async function clearPendingUploadRecords() {
  const sessions = listPendingUploads();
  await Promise.allSettled(sessions.map((item) => lanTransferApi.cancelUpload(item.uploadId)));
  clearPendingUploads();
  pendingUploads.value = [];
  await refreshLanInfo();
}

function categoryName(category: LanFileCategory) {
  const names: Record<LanFileCategory, string> = {
    image: "图片",
    video: "视频",
    audio: "音频",
    text: "文本",
    pdf: "PDF",
    archive: "压缩包",
    document: "文档",
    other: "其他"
  };
  return names[category];
}

async function onLanFilesChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);
  target.value = "";
  await uploadLanFiles(files);
}

async function onLanFilesDrop(event: DragEvent) {
  isDraggingFiles.value = false;
  await uploadLanFiles(Array.from(event.dataTransfer?.files ?? []));
}

function onLanFilesPaste(event: ClipboardEvent) {
  if (activeLanTab.value !== "files" || !canUploadFiles.value || isEditablePasteTarget(event.target)) return;
  const files = filesFromClipboard(event.clipboardData);
  if (!files.length) return;
  event.preventDefault();
  message.info(files.length > 1 ? `已粘贴 ${files.length} 个文件，开始上传` : `已粘贴 ${files[0].name}，开始上传`);
  void uploadLanFiles(files);
}

async function uploadLanFiles(files: File[]) {
  const queue = [...files];
  const workerCount = Math.min(2, queue.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length) {
        const file = queue.shift();
        if (file) await uploadLanFile(file);
      }
    })
  );
  await refreshLanInfo();
  await refreshLanFiles();
}

async function uploadLanFile(file: File) {
  const pending = findPendingUpload(file);
  const item = reactive<UploadItem>({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    size: file.size,
    progress: 0,
    status: "uploading"
  });
  uploadQueue.value = [item, ...uploadQueue.value];
  const uploader = new ConcurrentChunkUploader(file, undefined, { uploadId: pending?.uploadId });
  let activeUiRun: Promise<void> | undefined;
  let savedUploadId = pending?.uploadId;

  if (pending) message.info(`${file.name} 将从上次进度继续上传`);

  uploader.onProgress((snapshot) => {
    item.progress = snapshot.progress;
    item.status = snapshot.status;
    if (snapshot.uploadId && snapshot.uploadId !== savedUploadId) {
      savedUploadId = snapshot.uploadId;
      savePendingUpload(file, snapshot.uploadId);
      pendingUploads.value = listPendingUploads();
    }
  });

  function runUploadOnce(resume = false) {
    if (activeUiRun) {
      return activeUiRun;
    }

    activeUiRun = runUpload(resume).finally(() => {
      activeUiRun = undefined;
    });
    return activeUiRun;
  }

  async function runUpload(resume = false) {
    try {
      item.status = "uploading";
      const result = resume ? await uploader.resume() : await uploader.start();
      item.status = result.status;

      if (result.status === "done") {
        item.progress = 100;
        if (savedUploadId) removePendingUpload(savedUploadId);
        pendingUploads.value = listPendingUploads();
        message.success(`${file.name} 上传完成`);
      } else if (result.status === "paused") {
        message.info(`${file.name} 已暂停`);
      } else if (result.status === "canceled") {
        if (savedUploadId) removePendingUpload(savedUploadId);
        pendingUploads.value = listPendingUploads();
        message.warning(`${file.name} 已取消`);
      }
    } catch (error) {
      item.status = "failed";
      message.error(error instanceof Error ? error.message : `${file.name} 上传失败`);
    }
  }

  item.uploader = {
    pause: () => uploader.pause(),
    resume: async () => {
      await runUploadOnce(true);
    },
    cancel: async () => {
      try {
        await uploader.cancel();
        if (savedUploadId) removePendingUpload(savedUploadId);
        pendingUploads.value = listPendingUploads();
        uploadQueue.value = removeUploadItem(uploadQueue.value, item);
        message.warning(`${file.name} 已取消`);
      } catch (error) {
        item.status = "failed";
        message.error(error instanceof Error ? error.message : `${file.name} 取消失败`);
      }
    }
  };

  await runUploadOnce();
}

async function refreshLanFiles() {
  if (!canReadFiles.value) {
    lanFiles.value = [];
    lanPagination.total = 0;
    return;
  }
  try {
    const result = await lanTransferApi.listFiles({
      keyword: lanQuery.keyword,
      category: lanQuery.category,
      extension: lanQuery.extension,
      sortBy: lanQuery.sortBy,
      sortOrder: lanQuery.sortOrder,
      page: lanPagination.page,
      pageSize: lanPagination.pageSize
    });
    lanFiles.value = result.files;
    lanPagination.page = result.pagination.page;
    lanPagination.pageSize = result.pagination.pageSize;
    lanPagination.total = result.pagination.total;
    lanPagination.pageCount = result.pagination.pageCount;
    selectedLanFileIds.value = pruneSelectedIds(selectedLanFileIds.value, lanPageFileIds.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取文件列表失败");
  }
}

async function applyLanFilters() {
  lanPagination.page = 1;
  await refreshLanFiles();
}

async function resetLanFilters() {
  lanQuery.keyword = "";
  lanQuery.category = undefined;
  lanQuery.extension = "";
  lanQuery.sortBy = "createdAt";
  lanQuery.sortOrder = "desc";
  await applyLanFilters();
}

async function onLanPageSizeChange(pageSize: number) {
  lanPagination.page = 1;
  lanPagination.pageSize = pageSize;
  await refreshLanFiles();
}

async function openPreview(file: LanFileView) {
  previewFile.value = file;
  previewText.value = "";
  previewVisible.value = true;
  if (file.category === "text") {
    try {
      previewText.value = await lanTransferApi.getTextPreview(file.previewUrl);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "获取预览失败");
    }
  }
}

async function deleteLanFile(file: LanFileView) {
  if (!(await confirmAction(`删除 ${file.originalName}？`, { title: "删除文件" }))) {
    return;
  }
  try {
    await lanTransferApi.deleteFile(file.id);
    message.success("文件已删除");
    await refreshLanInfo();
    await refreshLanFiles();
  } catch (error) {
    message.error(error instanceof Error ? error.message : "删除文件失败");
  }
}

async function copyFileLink(file: LanFileView) {
  await copyText(new URL(file.downloadUrl, currentWebUrl()).toString());
}

async function extendFileExpiry(file: LanFileView) {
  try {
    await lanTransferApi.updateExpiry(file.id, 30);
    message.success(`${file.originalName} 已延长保留 30 天`);
    await refreshLanFiles();
  } catch (error) {
    message.error(error instanceof Error ? error.message : "更新文件有效期失败");
  }
}

function toggleLanFile(id: string, checked: boolean) {
  selectedLanFileIds.value = toggleSelectedId(selectedLanFileIds.value, id, checked);
}

function toggleAllLanFiles(checked: boolean) {
  selectedLanFileIds.value = togglePageSelection(selectedLanFileIds.value, lanPageFileIds.value, checked);
}

async function deleteSelectedLanFiles() {
  if (!selectedLanFileIds.value.length) return;
  if (!(await confirmAction(`删除选中的 ${selectedLanFileIds.value.length} 个文件？`, { title: "批量删除文件" }))) {
    return;
  }

  batchDeletingLanFiles.value = true;
  try {
    const ids = [...selectedLanFileIds.value];
    await lanTransferApi.deleteFiles(ids);
    selectedLanFileIds.value = [];
    if (lanFiles.value.length === ids.length && lanPagination.page > 1) {
      lanPagination.page -= 1;
    }
    await refreshLanInfo();
    await refreshLanFiles();
    message.success("已批量删除文件");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "批量删除文件失败");
  } finally {
    batchDeletingLanFiles.value = false;
  }
}

async function downloadSelectedLanFiles() {
  if (!selectedLanFileIds.value.length) return;
  batchDownloadingLanFiles.value = true;
  try {
    const { blob, contentDisposition } = await lanTransferApi.downloadFiles([...selectedLanFileIds.value]);
    const fileName = decodeDownloadFileName(contentDisposition) ?? `lan-files-${Date.now()}.zip`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    message.success("批量下载已开始");
    await refreshLanFiles();
  } catch (error) {
    message.error(error instanceof Error ? error.message : "批量下载文件失败");
  } finally {
    batchDownloadingLanFiles.value = false;
  }
}

function decodeDownloadFileName(contentDisposition?: string) {
  if (!contentDisposition) return undefined;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return /filename="?([^";]+)"?/i.exec(contentDisposition)?.[1];
}

async function copyText(value: string) {
  try {
    await copyTextToClipboard(value);
    message.success("已复制");
  } catch {
    message.error("复制失败，请手动选中地址复制");
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
</script>
