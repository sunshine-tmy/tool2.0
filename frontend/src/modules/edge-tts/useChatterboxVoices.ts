/**
 * 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互
 */
import { onMounted, watch, type ComputedRef, type Ref } from "vue";
import type {
  ChatterboxHealth,
  ChatterboxLanguage,
  ChatterboxSavedVoice,
  ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { chatterboxApi } from "./chatterbox-api";

type VoiceMessage = {
  success: (message: string) => void;
  error: (message: string) => void;
};

type ConfirmAction = (message: string, options: { title: string }) => Promise<boolean>;

type VoiceState = {
  health: Ref<ChatterboxHealth | undefined>;
  savedVoices: Ref<ChatterboxSavedVoice[]>;
  referenceFile: Ref<File | undefined>;
  referenceSource: Ref<"upload" | "saved">;
  selectedVoiceId: Ref<string>;
  retryVoiceId: Ref<string>;
  voiceName: Ref<string>;
  savingVoice: Ref<boolean>;
  language: Ref<ChatterboxLanguage>;
  authorization: Ref<ChatterboxVoiceAuthorization>;
  consentConfirmed: Ref<boolean>;
  errorMessage: Ref<string>;
  languageSavedVoices: ComputedRef<ChatterboxSavedVoice[]>;
  message: VoiceMessage;
  confirmAction: ConfirmAction;
};

export function useChatterboxVoices(state: VoiceState) {
  // 进入面板时并行恢复健康状态和永久音色；切换语言时自动修正不再适用的音色选择。
  onMounted(() => void Promise.all([loadHealth(), loadSavedVoices()]));
  watch(state.language, () => {
    if (state.referenceSource.value !== "saved") return;
    if (!state.languageSavedVoices.value.some((voice) => voice.id === state.selectedVoiceId.value)) {
      state.selectedVoiceId.value = state.languageSavedVoices.value[0]?.id || "";
    }
  });

  async function loadSavedVoices() {
    try {
      // 服务端是音色事实源；若当前文件不存在则默认切换到同语言的第一条永久音色。
      state.savedVoices.value = (await chatterboxApi.voices()).voices;
      if (
        state.selectedVoiceId.value &&
        !state.savedVoices.value.some((voice) => voice.id === state.selectedVoiceId.value)
      ) {
        state.selectedVoiceId.value = "";
      }
      if (!state.referenceFile.value && state.languageSavedVoices.value.length) {
        state.selectedVoiceId.value ||= state.languageSavedVoices.value[0].id;
        state.referenceSource.value = "saved";
      }
    } catch (error) {
      if (!isApiErrorCancelled(error)) state.errorMessage.value = formatApiError(error, "永久参考音色读取失败");
    }
  }

  async function saveCurrentVoice() {
    if (!state.referenceFile.value || !state.voiceName.value.trim() || !state.consentConfirmed.value) return;
    // 保存前要求明确授权和名称，成功后刷新列表并把新音色设为当前来源。
    state.savingVoice.value = true;
    try {
      const voice = await chatterboxApi.saveVoice({
        reference: state.referenceFile.value,
        name: state.voiceName.value.trim(),
        language: state.language.value,
        authorization: state.authorization.value,
        consentConfirmed: state.consentConfirmed.value
      });
      await loadSavedVoices();
      state.selectedVoiceId.value = voice.id;
      state.referenceSource.value = "saved";
      state.voiceName.value = "";
      state.message.success("参考音色已永久保存");
    } catch (error) {
      if (!isApiErrorCancelled(error)) state.message.error(formatApiError(error, "永久保存参考音色失败"));
    } finally {
      state.savingVoice.value = false;
    }
  }

  async function removeSavedVoice(voiceId: string) {
    if (!(await state.confirmAction("永久删除该参考音色？已经生成的音频不会受影响。", { title: "删除参考音色" })))
      return;
    try {
      // 删除永久音色不会影响已生成音频；若正在使用则同步清空编辑器和重生成选择。
      await chatterboxApi.removeVoice(voiceId);
      if (state.selectedVoiceId.value === voiceId) state.selectedVoiceId.value = "";
      if (state.retryVoiceId.value === voiceId) state.retryVoiceId.value = "";
      await loadSavedVoices();
      state.message.success("永久参考音色已删除");
    } catch (error) {
      if (!isApiErrorCancelled(error)) state.message.error(formatApiError(error, "删除永久参考音色失败"));
    }
  }

  async function loadHealth() {
    try {
      state.health.value = await chatterboxApi.health();
    } catch (error) {
      state.health.value = undefined;
      if (!isApiErrorCancelled(error)) state.errorMessage.value = formatApiError(error, "无法读取声音克隆服务状态");
    }
  }

  return { loadHealth, loadSavedVoices, saveCurrentVoice, removeSavedVoice };
}
