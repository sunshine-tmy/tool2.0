import { ref } from "vue";
import { useMessage } from "naive-ui";
import { audioLibraryApi as api } from "./api";
import { createUploadDraft, uploadFields, type AudioUploadDraft } from "./upload-draft";
import { rememberGroup, storedGroup } from "./preferences";
import type { AudioLibraryCollection } from "./useAudioLibraryCollection";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
export function useAudioLibraryTransfers(
  collection: AudioLibraryCollection,
  refreshQueue: () => Promise<unknown> | undefined
) {
  const { groups, groupId, language, load } = collection;
  const message = useMessage(),
    confirm = useConfirmDialog();
  const uploadVisible = ref(false),
    fileInput = ref<HTMLInputElement>(),
    uploads = ref<AudioUploadDraft[]>([]),
    uploading = ref(false);
  function selectFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    for (const file of Array.from(input.files || []).slice(0, 20)) {
      if (file.size > 100 * 1024 * 1024) {
        message.error(`${file.name} 超过 100 MiB`);
        continue;
      }
      const target = groupId.value || storedGroup();
      uploads.value.push(
        createUploadDraft(file, {
          language: language.value,
          groupId: groups.value.some((group) => group.value === target) ? target : null
        })
      );
    }
    input.value = "";
  }
  async function uploadOne(entry: AudioUploadDraft, keepDuplicate = false) {
    entry.failed = false;
    entry.message = "正在上传";
    try {
      const result = await api.upload(entry.file, uploadFields(entry, keepDuplicate), (progress) => {
        entry.message = `正在上传 ${progress}%`;
      });
      entry.done = true;
      entry.duplicate = result.existing;
      entry.message = result.existing ? "相同文件已存在，已跳过；可选择另存独立素材" : "已永久保存";
      rememberGroup(entry.groupId);
    } catch (e) {
      entry.failed = true;
      entry.message = formatApiError(e);
    }
  }
  async function uploadAll() {
    if (uploading.value) return;
    uploading.value = true;
    try {
      for (const entry of uploads.value) if (!entry.done || entry.failed) await uploadOne(entry);
      await load();
    } finally {
      uploading.value = false;
    }
  }
  async function uploadDuplicate(entry: AudioUploadDraft) {
    if (uploading.value) return;
    uploading.value = true;
    try {
      await uploadOne(entry, true);
      await load();
    } finally {
      uploading.value = false;
    }
  }
  const backupInput = ref<HTMLInputElement>(),
    restoring = ref(false);
  async function restoreBackup(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (
      !(await confirm("将校验备份并合并到当前音频库，已有素材不会被覆盖。继续恢复？", {
        title: "恢复备份",
        danger: false
      }))
    )
      return;
    restoring.value = true;
    try {
      const result = await api.restore(file);
      await refreshQueue();
      message.success(`恢复新增 ${result.added} 条，跳过已有 ${result.skipped} 条`);
      await load();
    } catch (e) {
      message.error(formatApiError(e));
    } finally {
      restoring.value = false;
    }
  }

  return {
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
  };
}
