<!-- 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理 -->
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
        <LanSharePanel
          v-model:selected-url="selectedShareUrl"
          v-model:access-pin="accessPin"
          :url-options="shareUrlOptions"
          :qr-code="shareQrCode"
          :info="lanInfo"
          :guest-description="guestModeDescription"
          :unlocking="unlocking"
          :pending-uploads="pendingUploads"
          @copy-url="copyText(selectedShareUrl)"
          @unlock="unlockLanTransfer"
          @clear-pending="clearPendingUploadRecords"
        />

        <n-tabs v-model:value="activeLanTab" class="lan-workspace-tabs" type="line" animated>
          <n-tab-pane name="files" tab="文件传输" display-directive="show">
            <LanUploadPanel
              :can-upload-files="canUploadFiles"
              :is-dragging-files="isDraggingFiles"
              :info="lanInfo"
              :upload-queue="uploadQueue"
              @update:is-dragging-files="isDraggingFiles = $event"
              @files-selected="uploadLanFiles"
            />
          </n-tab-pane>

          <n-tab-pane name="notes" tab="图文快传" display-directive="show">
            <LanNotePanel
              v-model:title="noteTitle"
              v-model:content="noteContent"
              :info="lanInfo"
              :can-upload="canUploadFiles"
              :can-read="canReadFiles"
              :can-manage="canManageFiles"
              :images="noteImages"
              :publishing="publishingNote"
              :notes="lanNotes"
              :selected-ids="selectedLanNoteIds"
              :page-selection="lanNotePageSelection"
              :batch-deleting="batchDeletingLanNotes"
              :pagination="notePagination"
              @select-images="addNoteImages"
              @paste="onNotePaste"
              @remove-image="removeNoteImage"
              @publish="publishNote"
              @copy-content="copyNoteContent"
              @copy-image-link="copyNoteImageLink"
              @extend-expiry="extendNoteExpiry"
              @delete-note="deleteLanNote"
              @toggle-note="toggleLanNote"
              @toggle-all="toggleAllLanNotes"
              @delete-selected="deleteSelectedLanNotes"
              @page-change="onNotePageChange"
              @page-size-change="onNotePageSizeChange"
            />
          </n-tab-pane>
        </n-tabs>

        <LanFileListPanel
          v-show="activeLanTab === 'files'"
          v-model:keyword="lanQuery.keyword"
          v-model:category="lanQuery.category"
          v-model:extension="lanQuery.extension"
          v-model:sort-by="lanQuery.sortBy"
          v-model:sort-order="lanQuery.sortOrder"
          v-model:page="lanPagination.page"
          v-model:page-size="lanPagination.pageSize"
          :can-read-files="canReadFiles"
          :can-manage-files="canManageFiles"
          :files="lanFiles"
          :selected-ids="selectedLanFileIds"
          :batch-deleting="batchDeletingLanFiles"
          :batch-downloading="batchDownloadingLanFiles"
          :pagination="lanPagination"
          :category-options="lanCategoryOptions"
          :sort-options="lanSortOptions"
          :sort-order-options="lanSortOrderOptions"
          @apply-filters="applyLanFilters"
          @reset-filters="resetLanFilters"
          @toggle-all="toggleAllLanFiles"
          @toggle-file="toggleLanFile"
          @download-selected="downloadSelectedLanFiles"
          @delete-selected="deleteSelectedLanFiles"
          @preview="openPreview"
          @copy-link="copyFileLink"
          @extend-expiry="extendFileExpiry"
          @delete-file="deleteLanFile"
          @page-change="refreshLanFiles"
          @page-size-change="onLanPageSizeChange"
        />
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
        <div v-else-if="previewFile.category === 'document' && officePreviewLoading" class="office-preview-status">
          正在准备 Word、Excel 或 PPT 预览…
        </div>
        <iframe
          v-else-if="previewFile.category === 'document' && officePreviewUrl"
          :src="officePreviewUrl"
          sandbox="allow-scripts allow-same-origin allow-downloads"
          referrerpolicy="no-referrer"
          title="Office document preview"
        />
        <n-empty
          v-else-if="previewFile.category === 'document'"
          :description="officePreviewError || 'Office 预览暂不可用，请下载后查看。'"
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
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { NButton, NEmpty, NModal, NTabPane, NTabs, useMessage } from "naive-ui";
import type { LanFileCategory, LanFileSortBy, LanFileSortOrder } from "@toolbox/shared";
import { lanNoteLimits } from "@toolbox/shared";
import { RefreshCw } from "lucide-vue-next";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import LanFileListPanel from "./LanFileListPanel.vue";
import LanNotePanel from "./LanNotePanel.vue";
import LanSharePanel from "./LanSharePanel.vue";
import LanUploadPanel from "./LanUploadPanel.vue";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { currentWebUrl } from "../../config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { copyTextToClipboard } from "../../utils/clipboard";
import { lanTransferApi } from "./api";
import type { LanFileView, LanNoteView } from "./types";
import { useLanFileBatchActions } from "./useLanFileBatchActions";
import { useLanShareState } from "./useLanShareState";
import { useLanUploadQueue } from "./useLanUploadQueue";
import {
  getPageSelectionState,
  pruneSelectedIds,
  togglePageSelection,
  toggleSelectedId
} from "../../utils/batch-selection";

const message = useMessage();
const confirmAction = useConfirmDialog();
const activeLanTab = ref<"files" | "notes">("files");
const lanFiles = ref<LanFileView[]>([]);
const previewVisible = ref(false);
const previewFile = ref<LanFileView | null>(null);
const previewText = ref("");
const officePreviewUrl = ref("");
const officePreviewLoading = ref(false);
const officePreviewError = ref("");
const noteTitle = ref("");
const noteContent = ref("");
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
const {
  lanInfo,
  selectedShareUrl,
  shareQrCode,
  accessPin,
  unlocking,
  lanCategoryOptions,
  shareUrlOptions,
  guestModeDescription,
  canReadFiles,
  canUploadFiles,
  canManageFiles
} = useLanShareState();
const {
  selectedIds: selectedLanFileIds,
  deleting: batchDeletingLanFiles,
  downloading: batchDownloadingLanFiles,
  toggleFile: toggleLanFile,
  toggleAll: toggleAllLanFiles,
  deleteSelected: deleteSelectedLanFiles,
  downloadSelected: downloadSelectedLanFiles,
  pruneSelection: pruneLanFileSelection
} = useLanFileBatchActions({
  files: lanFiles,
  pagination: lanPagination,
  refreshInfo: refreshLanInfo,
  refreshFiles: refreshLanFiles,
  confirm: confirmAction,
  message
});
const { pendingUploads, uploadQueue, isDraggingFiles, clearPendingUploadRecords, onLanFilesPaste, uploadLanFiles } =
  useLanUploadQueue({
    activeTab: activeLanTab,
    canUploadFiles,
    refreshLanInfo,
    refreshLanFiles,
    message
  });
const lanNotePageIds = computed(() => lanNotes.value.map((note) => note.id));
const lanNotePageSelection = computed(() => getPageSelectionState(selectedLanNoteIds.value, lanNotePageIds.value));

onMounted(async () => {
  // 页面初始化先读取访问能力和分享地址，再并行加载文件/图文列表，避免访客权限下误显示旧数据。
  document.addEventListener("paste", onLanFilesPaste);
  await refreshLanInfo();
  await Promise.all([refreshLanFiles(), refreshLanNotes()]);
});

onUnmounted(() => {
  // 卸载时移除全局粘贴监听并释放图文预览 Blob URL，上传任务本身由队列作用域负责收敛。
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
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "获取传输服务信息失败"));
  }
}

async function refreshLanTransfer() {
  // 手动刷新保持信息、文件和图文列表的一致快照；列表请求可并行但统一完成后再更新提示。
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
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "获取图文列表失败"));
  }
}

async function unlockLanTransfer() {
  if (!accessPin.value) return;
  unlocking.value = true;
  try {
    // PIN 解锁成功后重新拉取权限和列表，避免仅在前端切换布尔值造成越权展示。
    await lanTransferApi.unlock(accessPin.value);
    accessPin.value = "";
    await refreshLanInfo();
    await Promise.all([refreshLanFiles(), refreshLanNotes()]);
    message.success("管理权限已解锁");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "访问 PIN 不正确"));
  } finally {
    unlocking.value = false;
  }
}

function onNotePaste(event: ClipboardEvent) {
  const images = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
  if (!images.length) return;
  addNoteImages(images);
  message.success(images.length > 1 ? `已粘贴 ${images.length} 张图片` : "已粘贴剪贴板图片");
}

function addNoteImages(selected: File[]) {
  // 图片数量、单图大小、总大小和重复文件在进入 FormData 前全部校验，降低无效上传占用。
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
    // 发布成功才清空编辑器；失败时保留原文本和图片，方便用户修正后重试。
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
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "发布图文失败"));
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
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "更新图文有效期失败"));
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
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "删除图文失败"));
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
    // 复制选中 ID 后再提交，避免请求期间用户操作选择框导致删除集合变化。
    const ids = [...selectedLanNoteIds.value];
    await lanTransferApi.deleteNotes(ids);
    selectedLanNoteIds.value = [];
    if (lanNotes.value.length === ids.length && notePagination.page > 1) notePagination.page -= 1;
    await Promise.all([refreshLanInfo(), refreshLanNotes()]);
    message.success("已批量删除图文");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "批量删除图文失败"));
  } finally {
    batchDeletingLanNotes.value = false;
  }
}

async function onNotePageSizeChange(pageSize: number) {
  notePagination.page = 1;
  notePagination.pageSize = pageSize;
  await refreshLanNotes();
}

async function onNotePageChange(page: number) {
  notePagination.page = page;
  await refreshLanNotes();
}

async function refreshLanFiles() {
  if (!canReadFiles.value) {
    lanFiles.value = [];
    lanPagination.total = 0;
    return;
  }
  try {
    // 列表条件和分页由服务端统一计算；刷新后裁剪当前页之外的选择，避免批量操作命中过期记录。
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
    pruneLanFileSelection();
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "获取文件列表失败"));
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
  officePreviewUrl.value = "";
  officePreviewError.value = "";
  previewVisible.value = true;
  if (file.category === "text") {
    // 只有文本文件需要额外请求正文；图片、视频、音频和 PDF 由安全预览 URL 直接加载。
    try {
      previewText.value = await lanTransferApi.getTextPreview(file.previewUrl);
    } catch (error) {
      if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "获取预览失败"));
    }
  }
  if (file.category === "document") {
    officePreviewLoading.value = true;
    try {
      // Office 文件由本机 kkFileView 转为安全预览页；后端签发的源地址只在短时间内对该文件有效。
      const preview = await lanTransferApi.createOfficePreview(file.id);
      officePreviewUrl.value = preview.viewerUrl;
    } catch (error) {
      if (!isApiErrorCancelled(error)) {
        officePreviewError.value = formatApiError(error, "创建 Office 预览失败");
      }
    } finally {
      officePreviewLoading.value = false;
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
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "删除文件失败"));
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
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "更新文件有效期失败"));
  }
}

async function copyText(value: string) {
  try {
    await copyTextToClipboard(value);
    message.success("已复制");
  } catch {
    message.error("复制失败，请手动选中地址复制");
  }
}
</script>
