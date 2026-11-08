<template>
  <ToolLayout class="speech-layout"
    ><section class="edge-tts-page v2-tool-page speech-page">
      <ToolPageHeader
        title="多国语言配音"
        description="在线配音与音色克隆，支持多种语言的批量生成。"
        kicker="MULTILINGUAL SPEECH"
      >
        <template #actions
          ><n-tag v-if="engine === 'edge'" :type="health?.available ? 'success' : 'info'" round
            >Edge-TTS {{ health?.version || "在线配音" }}</n-tag
          ><n-tag v-else type="info" round>Chatterbox Multilingual V3</n-tag></template
        >
      </ToolPageHeader>
      <div v-if="engine === 'edge'" class="edge-tts-privacy">
        <Cloud :size="18" /><span
          >此功能需要联网，外语文案会发送到微软在线语音服务；中文译文仅用于本地字幕与归档，生成文件默认保留 3 天。</span
        >
      </div>
      <div v-else class="chatterbox-notice">
        <ShieldCheck :size="16" />
        <div>
          <strong>仅克隆你本人或已获得明确授权的声音</strong>
          <span>一个批次只需上传一次参考音色，可生成独立 MP3、按顺序拼接的总音频及多种字幕。</span>
        </div>
        <n-tag :type="cloneNotice.type" :title="cloneNotice.message" round>{{ cloneNotice.label }}</n-tag>
      </div>
      <div class="edge-tts-engine-tabs" role="tablist" aria-label="配音引擎">
        <button
          type="button"
          :class="{ active: engine === 'chatterbox' }"
          role="tab"
          :aria-selected="engine === 'chatterbox'"
          @click="engine = 'chatterbox'"
        >
          <Mic2 :size="18" /><span><strong>参考音色克隆</strong><small>本地 CPU / GPU</small></span>
        </button>
        <button
          type="button"
          :class="{ active: engine === 'edge' }"
          role="tab"
          :aria-selected="engine === 'edge'"
          @click="engine = 'edge'"
        >
          <Cloud :size="18" /><span><strong>在线配音</strong><small>在线服务</small></span>
        </button>
      </div>
      <KeepAlive>
        <EdgeTtsPanel v-if="engine === 'edge'" @health="health = $event" />
        <ChatterboxPanel v-else @notice="cloneNotice = $event" />
      </KeepAlive></section
  ></ToolLayout>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { NTag } from "naive-ui";
import { Mic2, Cloud, ShieldCheck } from "lucide-vue-next";
import type { EdgeTtsHealth } from "@toolbox/shared";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import ChatterboxPanel from "./chatterbox/ChatterboxPanel.vue";
import EdgeTtsPanel from "./edge-tts/EdgeTtsPanel.vue";
const engine = ref<"edge" | "chatterbox">("chatterbox");
const health = ref<EdgeTtsHealth>();
const cloneNotice = ref<{ label: string; type: "info" | "error" | "success"; message?: string }>({
  label: "读取本机音色状态",
  type: "info"
});
</script>

<style scoped>
.speech-layout :deep(.content) {
  max-width: none;
  padding: 28px 32px 40px;
}
.speech-page :deep(.tool-page-header) {
  margin-bottom: 24px;
}
.speech-page :deep(.tool-page-icon) {
  width: 72px;
  height: 72px;
}
.speech-page :deep(.tool-page-header h2) {
  font-size: 30px;
  line-height: 1.3;
}
.speech-page :deep(.chatterbox-panel),
.speech-page :deep(.online-tts-panel) {
  display: grid;
  gap: 20px;
}
.speech-page :deep(.chatterbox-notice) {
  padding: 4px 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--color-text-secondary);
}
.speech-page :deep(.chatterbox-notice strong) {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.speech-page :deep(.chatterbox-notice > div > span) {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.speech-page :deep(.chatterbox-notice > svg) {
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
}
.speech-page :deep(.chatterbox-notice > .n-tag) {
  background: var(--color-surface-subtle);
  color: var(--color-text-secondary);
  font-size: 11px;
}
.speech-page :deep(.chatterbox-notice .n-tag__border) {
  border-color: var(--color-border);
}
.edge-tts-privacy {
  padding: 4px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.edge-tts-privacy > svg {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
}
.speech-page :deep(:is(.chatterbox-panel, .online-tts-panel) .edge-tts-workbench) {
  grid-template-columns: minmax(0, 1fr) minmax(340px, 31%);
  gap: 20px;
  align-items: start;
  overflow: visible;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.speech-page :deep(:is(.chatterbox-panel, .online-tts-panel) .edge-tts-editor),
.speech-page :deep(:is(.chatterbox-panel, .online-tts-panel) .edge-tts-controls) {
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.speech-page :deep(.edge-tts-controls) {
  gap: 18px;
}
.speech-page :deep(.speech-settings-title) {
  margin: 0;
  color: var(--color-text);
  font-size: 20px;
  font-weight: 700;
}
.speech-page :deep(.panel-heading h3) {
  color: var(--color-text);
  font-size: 18px;
}
.speech-page :deep(.panel-heading p),
.speech-page :deep(.panel-heading > span) {
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}
.speech-page :deep(.speech-reference-picker) {
  margin-bottom: 22px;
}
.speech-page :deep(.speech-reference-picker > summary) {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  list-style: none;
  cursor: pointer;
}
.speech-page :deep(.speech-reference-picker > summary::-webkit-details-marker) {
  display: none;
}
.speech-page :deep(.speech-reference-picker > summary:focus-visible) {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 4px;
  border-radius: 8px;
}
.speech-page :deep(.speech-reference-label),
.speech-page :deep(.speech-batch-name > label) {
  font-weight: 600;
  color: var(--color-text);
}
.speech-page :deep(.speech-reference-current) {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  min-height: 64px;
  box-sizing: border-box;
  border: 1px solid var(--color-primary-200);
  border-radius: 10px;
  background: var(--color-surface-subtle);
  color: var(--color-primary-600);
}
.speech-page :deep(.speech-reference-current > svg) {
  flex-shrink: 0;
}
.speech-page :deep(.speech-reference-current > span) {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 4px;
}
.speech-page :deep(.speech-reference-current strong) {
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
.speech-page :deep(.speech-reference-current small) {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.speech-page :deep(.reference-name-row strong) {
  min-width: 0;
}
.speech-page :deep(.speech-reference-body) {
  margin-top: 14px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-subtle);
}
.speech-page :deep(.speech-reference-body .panel-heading h3) {
  font-size: 14px;
}
.speech-page :deep(.chatterbox-dropzone) {
  min-height: 108px;
  margin-top: 0;
  padding: 16px;
  border-color: var(--color-primary-200);
  background: var(--color-surface);
  color: var(--color-primary-600);
}
.speech-page :deep(.voice-source-tabs button) {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 12px;
}
.speech-page :deep(.voice-source-tabs button.active) {
  color: var(--color-primary-700);
  border-color: var(--color-primary-200);
  background: var(--color-primary-50);
}
.speech-page :deep(.saved-voice-list article) {
  grid-template-columns: minmax(0, 1fr) auto auto;
  border-color: var(--color-border);
  background: var(--color-surface);
}
.speech-page :deep(.saved-voice-list article.selected) {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
  box-shadow: none;
}
.speech-page :deep(.saved-voice-list audio) {
  grid-column: 1 / -1;
  grid-row: 2;
}
.speech-page :deep(.speech-batch-name) {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}
.speech-page :deep(.batch-heading) {
  margin-top: 0;
}
.speech-page :deep(.batch-toolbar) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  margin-bottom: 16px;
}
.speech-page :deep(.batch-toolbar > .n-button) {
  flex: 0 0 auto;
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  box-shadow: none;
  font-size: 12px;
}
.speech-page :deep(.batch-toolbar .n-button__content) {
  gap: 6px;
}
.speech-page :deep(.batch-toolbar > .n-button--default-type) {
  color: var(--color-text-secondary);
  background: var(--color-surface);
  --n-border: 1px solid var(--color-border);
}
.speech-page :deep(.batch-toolbar > .n-button--primary-type) {
  font-weight: 600;
}
.speech-page :deep(.batch-toolbar > .batch-clear) {
  margin-left: auto;
  background: transparent;
}
.speech-page :deep(.batch-toolbar > :first-child) {
  flex: 0 1 auto;
}
.speech-page :deep(.segment-editor-list) {
  gap: 12px;
}
.speech-page :deep(.segment-editor-card) {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  padding: 16px;
  border-color: var(--color-border);
  background: var(--color-surface);
  border-radius: 12px;
}
.speech-page :deep(.segment-order) {
  grid-column: 1;
  grid-row: 1;
  flex-direction: row;
  justify-content: flex-start;
  gap: 8px;
  color: var(--color-text-tertiary);
}
.speech-page :deep(.segment-order strong) {
  display: grid;
  place-items: center;
  width: 32px;
  height: 28px;
  border-radius: 7px;
  font-size: 14px;
  color: var(--color-primary-700);
  background: var(--color-primary-100);
}
.speech-page :deep(.segment-fields) {
  grid-column: 1 / -1;
  grid-row: 2;
  min-width: 0;
  gap: 14px;
}
.speech-page :deep(.speech-segment-field) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 7px;
}
.speech-page :deep(.speech-segment-field > label) {
  padding-top: 0;
  font-size: 13px;
  color: var(--color-text);
  font-weight: 600;
}
.speech-page :deep(.segment-actions) {
  grid-column: 2;
  grid-row: 1;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.speech-page :deep(.segment-actions .n-button) {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--color-text-secondary);
  background: var(--color-surface-subtle);
}
.speech-page :deep(.segment-actions .n-button--error-type) {
  color: var(--color-error);
}
.speech-page :deep(.segment-editor-card .n-input) {
  background: var(--color-surface-subtle);
}
.speech-page :deep(.speech-segment-field > label > span) {
  color: var(--color-error);
}
.speech-page :deep(.speech-segment-field small) {
  font-weight: 400;
  color: var(--color-text-secondary);
}
.speech-page :deep(.edge-tts-editor .n-input) {
  background: var(--color-surface);
}
.speech-page :deep(.chatterbox-language-grid) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.speech-page :deep(.edge-tts-language-grid button) {
  min-width: 0;
  padding: 10px;
  border-color: var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-subtle);
}
.speech-page :deep(.edge-tts-language-grid button.active) {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
  color: var(--color-primary-700);
}
.speech-page :deep(.edge-tts-language-grid strong) {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.speech-page :deep(.edge-tts-language-grid span) {
  font-size: 11px;
  color: var(--color-text-secondary);
}
.speech-page :deep(.chatterbox-device-option) {
  gap: 8px;
  min-height: 48px;
  padding: 10px;
  border-color: var(--color-border);
  background: var(--color-surface-subtle);
}
.speech-page :deep(.chatterbox-device-option.active) {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  box-shadow: none;
}
.speech-page :deep(.chatterbox-device-option input) {
  position: static;
  width: 16px;
  height: 16px;
  clip: auto;
  clip-path: none;
  accent-color: var(--color-primary-600);
  flex-shrink: 0;
}
.speech-page :deep(.control-section) {
  gap: 10px;
}
.speech-page :deep(.control-section + .control-section) {
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.speech-page :deep(.control-section > label),
.speech-page :deep(.control-label-row label) {
  color: var(--color-text);
  font-weight: 600;
}
.speech-page :deep(.range-control > span) {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.speech-page :deep(.range-control strong) {
  padding: 2px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  background: var(--color-surface-subtle);
  font-weight: 500;
}
.speech-page :deep(.chatterbox-seed) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
}
.speech-page :deep(.chatterbox-hint),
.speech-page :deep(.chatterbox-device-hint) {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.7;
}
.speech-page :deep(.edge-tts-controls > .n-button--primary-type) {
  min-height: 46px;
  font-weight: 600;
  font-size: 15px;
  border-radius: 10px;
}
.speech-page :deep(.edge-tts-history),
.speech-page :deep(.edge-tts-result) {
  margin: 0;
  padding: 22px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
}
.speech-page :deep(.edge-tts-history .panel-heading h3) {
  margin-top: 0;
}
.speech-page :deep(.edge-tts-result) {
  border-color: var(--color-primary-200);
  background: linear-gradient(120deg, var(--color-surface-subtle), var(--color-surface) 65%);
}
.speech-page :deep(.edge-tts-result > .panel-heading) {
  align-items: center;
  gap: 16px;
  margin: 0;
}
.speech-page :deep(.edge-tts-result > .panel-heading > div) {
  min-width: 0;
}
.speech-page :deep(.edge-tts-result .eyebrow) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  padding: 4px 9px;
  background: var(--color-primary-100);
  border-radius: 6px;
  color: var(--color-primary-700);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0;
}
.speech-page :deep(.edge-tts-result .panel-heading h3) {
  margin: 0 0 8px;
  color: var(--color-text);
  font-size: 18px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.speech-page :deep(.edge-tts-result .panel-heading p:not(.eyebrow)) {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.speech-page :deep(.edge-tts-result .chatterbox-batch-status-badge) {
  flex-shrink: 0;
  min-height: 28px;
  padding: 0 12px;
  border-color: transparent;
  border-radius: 999px;
}
.speech-page :deep(.edge-tts-result .chatterbox-batch-status-badge--success) {
  color: #16804a;
  background: #eaf7ef;
}
.speech-page :deep(.edge-tts-result .chatterbox-batch-status-badge--default) {
  color: var(--color-primary-700);
  background: var(--color-primary-100);
}
.speech-page :deep(.edge-tts-result .edge-tts-progress) {
  height: 6px;
  margin: 18px 0 0;
  background: var(--color-primary-100);
}
.speech-page :deep(.edge-tts-result .edge-tts-progress > span) {
  background: linear-gradient(90deg, var(--color-primary-500), var(--color-primary-600));
}
.speech-page :deep(.edge-tts-result-actions) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.speech-page :deep(.edge-tts-result-actions .n-button) {
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  box-shadow: none;
  font-size: 12px;
}
.speech-page :deep(.edge-tts-result-actions .n-button--default-type) {
  color: var(--color-primary-700);
  background: var(--color-surface);
  --n-border: 1px solid var(--color-primary-200);
}
.speech-page :deep(.edge-tts-result-actions .n-button--primary-type) {
  font-weight: 600;
}
.speech-page :deep(.edge-tts-result-actions .library-save-actions) {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
  padding-left: 14px;
  border-left: 1px solid var(--color-border);
}
.speech-page :deep(.speech-batch-selection-toolbar) {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--color-primary-50);
  color: var(--color-text-secondary);
}
.speech-page :deep(.edge-tts-history-list article) {
  padding: 14px 16px;
  background: var(--color-surface-subtle);
  border-color: var(--color-border);
  border-radius: 10px;
}
.speech-page :deep(.history-main strong) {
  color: var(--color-text);
}
.speech-page :deep(.voice-avatar) {
  background: var(--color-primary-50);
  color: var(--color-primary-600);
}
.speech-page :deep(.batch-history-meta) {
  flex-wrap: wrap;
  gap: 8px;
}
.speech-page :deep(.chatterbox-batch-device-badge) {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
  border-color: var(--color-primary-200);
}
.speech-page :deep(.history-actions) {
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}
.speech-page :deep(.history-actions .n-button:not(.n-button--error-type)) {
  color: var(--color-primary-700);
  background: transparent;
  box-shadow: none;
}
.speech-page :deep(.history-actions .n-button--primary-type) {
  border-color: var(--color-primary-200);
}
.speech-page :deep(.chatterbox-batch-pagination) {
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}
.edge-tts-engine-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  background: transparent;
  border-radius: 0;
  border-bottom: 1px solid var(--color-border);
  box-shadow: none;
  margin-bottom: 20px;
}
.edge-tts-engine-tabs button {
  width: auto;
  min-height: 48px;
  padding: 12px 20px;
  border: 0;
  border-bottom: 3px solid transparent;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  color: var(--color-text-secondary);
  gap: 10px;
}
.edge-tts-engine-tabs button.active {
  border-bottom-color: var(--color-primary-600);
  color: var(--color-primary-700);
  background: transparent;
  box-shadow: none;
  font-weight: 700;
}
.edge-tts-engine-tabs button span {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.edge-tts-engine-tabs button small {
  font-size: 12px;
  color: var(--color-text-secondary);
}
@media (max-width: 1050px) {
  .speech-page :deep(.edge-tts-result-actions .library-save-actions) {
    margin-left: 0;
    padding-left: 0;
    border-left: 0;
  }
  .speech-page :deep(:is(.chatterbox-panel, .online-tts-panel) .edge-tts-workbench) {
    grid-template-columns: minmax(0, 1fr);
  }
  .speech-page :deep(.chatterbox-language-grid) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .speech-layout :deep(.content) {
    padding: 20px 16px 28px;
  }
  .speech-page :deep(.tool-page-icon) {
    width: 56px;
    height: 56px;
  }
  .speech-page :deep(.tool-page-header h2) {
    font-size: 26px;
  }
  .speech-page :deep(:is(.chatterbox-panel, .online-tts-panel) .edge-tts-editor),
  .speech-page :deep(:is(.chatterbox-panel, .online-tts-panel) .edge-tts-controls),
  .speech-page :deep(.edge-tts-history),
  .speech-page :deep(.edge-tts-result) {
    padding: 16px;
  }
  .speech-page :deep(.speech-reference-picker > summary) {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
  }
  .speech-page :deep(.speech-reference-label) {
    grid-column: 1 / -1;
  }
  .speech-page :deep(.speech-reference-body) {
    padding: 12px;
  }
  .speech-page :deep(.speech-batch-name) {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .speech-page :deep(.speech-segment-field) {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .speech-page :deep(.speech-segment-field > label) {
    padding-top: 0;
  }
  .speech-page :deep(.segment-editor-card) {
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 12px;
    gap: 10px;
  }
  .speech-page :deep(.segment-actions) {
    grid-column: 2;
    flex-direction: row;
  }
  .speech-page :deep(.speech-reference-body .save-voice-row) {
    grid-template-columns: minmax(0, 1fr);
  }
  .speech-page :deep(.chatterbox-notice) {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .speech-page :deep(.chatterbox-notice > .n-tag) {
    grid-column: 2;
    justify-self: start;
  }
  .speech-page :deep(.chatterbox-language-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .edge-tts-engine-tabs button {
    flex: 1;
    justify-content: center;
    padding-inline: 8px;
  }
  .edge-tts-engine-tabs button small {
    display: none;
  }
}
</style>
