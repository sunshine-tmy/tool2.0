/**
 * 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理
 */
import { reactive, ref, type ComputedRef, type Ref } from "vue";
import { useRequestScope } from "../../composables/useRequestScope";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { isEditablePasteTarget, filesFromClipboard } from "./paste-upload";
import { ConcurrentChunkUploader } from "./chunk-uploader";
import { lanTransferApi } from "./api";
import type { PendingLanUpload, UploadItem } from "./types";
import {
  clearPendingUploads,
  findPendingUpload,
  listPendingUploads,
  removePendingUpload,
  savePendingUpload
} from "./upload-resume";
import { removeUploadItem } from "./upload-queue";

type UploadMessage = {
  info: (message: string) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
};

export function useLanUploadQueue(options: {
  activeTab: Ref<"files" | "notes">;
  canUploadFiles: ComputedRef<boolean>;
  refreshLanInfo: () => Promise<void>;
  refreshLanFiles: () => Promise<void>;
  message: UploadMessage;
}) {
  const requestScope = useRequestScope();
  const pendingUploads = ref<PendingLanUpload[]>(listPendingUploads());
  const uploadQueue = ref<UploadItem[]>([]);
  const isDraggingFiles = ref(false);

  async function clearPendingUploadRecords() {
    // 清理断点记录前尽量取消服务端会话；Promise.allSettled 保证单个失效会话不会阻断其它清理。
    const sessions = listPendingUploads();
    await Promise.allSettled(sessions.map((item) => lanTransferApi.cancelUpload(item.uploadId)));
    clearPendingUploads();
    pendingUploads.value = [];
    await options.refreshLanInfo();
  }

  function onLanFilesPaste(event: ClipboardEvent) {
    // 仅在文件页且目标不是可编辑元素时接管粘贴，避免破坏文本框的正常输入行为。
    if (options.activeTab.value !== "files" || !options.canUploadFiles.value || isEditablePasteTarget(event.target)) {
      return;
    }
    const files = filesFromClipboard(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    options.message.info(
      files.length > 1 ? `已粘贴 ${files.length} 个文件，开始上传` : `已粘贴 ${files[0].name}，开始上传`
    );
    void uploadLanFiles(files);
  }

  async function uploadLanFiles(files: File[]) {
    // 浏览器端最多同时运行两个文件任务；每个任务内部再由分片上传器控制分片并发。
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
    await options.refreshLanInfo();
    await options.refreshLanFiles();
  }

  async function uploadLanFile(file: File) {
    // 优先按文件指纹恢复本地断点记录；上传器只在服务端确认分片后更新 UI 进度。
    const pending = findPendingUpload(file);
    const item = reactive<UploadItem>({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading"
    });
    uploadQueue.value = [item, ...uploadQueue.value];
    const uploader = new ConcurrentChunkUploader(file, undefined, {
      uploadId: pending?.uploadId,
      signal: requestScope.signal
    });
    let activeUiRun: Promise<void> | undefined;
    let savedUploadId = pending?.uploadId;

    if (pending) options.message.info(`${file.name} 将从上次进度继续上传`);
    uploader.onProgress((snapshot) => {
      // 首次创建或服务端重建会话时保存新的 uploadId，刷新页面后仍可继续上传。
      item.progress = snapshot.progress;
      item.status = snapshot.status;
      if (snapshot.uploadId && snapshot.uploadId !== savedUploadId) {
        savedUploadId = snapshot.uploadId;
        savePendingUpload(file, snapshot.uploadId);
        pendingUploads.value = listPendingUploads();
      }
    });

    function runUploadOnce(resume = false) {
      if (activeUiRun) return activeUiRun;
      activeUiRun = runUpload(resume).finally(() => {
        activeUiRun = undefined;
      });
      return activeUiRun;
    }

    async function runUpload(resume = false) {
      try {
        // 页面卸载产生的取消不提示失败；用户主动取消才移除本地断点记录。
        item.status = "uploading";
        const result = resume ? await uploader.resume() : await uploader.start();
        item.status = result.status;
        if (result.status === "done") {
          item.progress = 100;
          if (savedUploadId) removePendingUpload(savedUploadId);
          pendingUploads.value = listPendingUploads();
          options.message.success(`${file.name} 上传完成`);
        } else if (result.status === "paused") {
          options.message.info(`${file.name} 已暂停`);
        } else if (result.status === "canceled" && !requestScope.aborted) {
          if (savedUploadId) removePendingUpload(savedUploadId);
          pendingUploads.value = listPendingUploads();
          options.message.warning(`${file.name} 已取消`);
        }
      } catch (error) {
        if (requestScope.aborted) {
          item.status = "canceled";
          return;
        }
        item.status = "failed";
        if (!isApiErrorCancelled(error)) options.message.error(formatApiError(error, `${file.name} 上传失败`));
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
          options.message.warning(`${file.name} 已取消`);
        } catch (error) {
          if (requestScope.aborted) return;
          item.status = "failed";
          if (!isApiErrorCancelled(error)) options.message.error(formatApiError(error, `${file.name} 取消失败`));
        }
      }
    };

    await runUploadOnce();
  }

  return {
    pendingUploads,
    uploadQueue,
    isDraggingFiles,
    clearPendingUploadRecords,
    onLanFilesPaste,
    uploadLanFiles
  };
}
