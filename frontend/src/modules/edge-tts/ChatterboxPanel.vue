<template>
  <div class="chatterbox-panel">
    <div class="chatterbox-notice">
      <ShieldCheck :size="19" />
      <div>
        <strong>仅克隆你本人或已获得明确授权的声音</strong>
        <span>一个批次只需上传一次参考音色，可生成独立 MP3、按顺序拼接的总音频及多种字幕。</span>
      </div>
      <n-tag :type="health?.available ? 'success' : 'error'" round>{{ healthLabel }}</n-tag>
    </div>

    <section class="edge-tts-workbench chatterbox-workbench">
      <div class="edge-tts-editor chatterbox-editor batch-editor">
        <div class="panel-heading">
          <div>
            <h3>参考音色</h3>
            <p>推荐 10–20 秒、单人、无背景音乐且与目标语言一致的清晰录音。</p>
          </div>
          <span>5–30 秒 · 最大 20 MB</span>
        </div>
        <div class="voice-source-tabs">
          <button type="button" :class="{ active: referenceSource === 'upload' }" @click="referenceSource = 'upload'">
            <UploadCloud :size="16" />上传新音色
          </button>
          <button type="button" :class="{ active: referenceSource === 'saved' }" @click="referenceSource = 'saved'">
            <Library :size="16" />永久音色库（{{ savedVoices.length }}）
          </button>
        </div>
        <template v-if="referenceSource === 'upload'">
          <label class="chatterbox-dropzone" :class="{ 'has-file': referenceFile }">
            <input type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac" @change="selectReference" />
            <template v-if="referenceFile">
              <FileAudio :size="30" /><strong>{{ referenceFile.name }}</strong>
              <span>{{ formatBytes(referenceFile.size) }} · 点击重新选择</span>
            </template>
            <template v-else>
              <UploadCloud :size="32" /><strong>上传参考音频</strong><span>整个批次共用同一份参考音色</span>
            </template>
          </label>
          <audio v-if="referencePreview" class="edge-tts-player" controls preload="metadata" :src="referencePreview" />
          <div v-if="referenceFile" class="save-voice-row">
            <n-input
              v-model:value="voiceName"
              maxlength="100"
              clearable
              placeholder="输入音色名称，永久保存后可重复使用"
            />
            <n-button
              :loading="savingVoice"
              :disabled="!voiceName.trim() || !consentConfirmed"
              @click="saveCurrentVoice"
            >
              <Save :size="16" />永久保存音色
            </n-button>
          </div>
        </template>
        <div v-else class="saved-voice-list">
          <article
            v-for="voice in languageSavedVoices"
            :key="voice.id"
            :class="{ selected: selectedVoiceId === voice.id }"
            @click="selectedVoiceId = voice.id"
          >
            <div class="saved-voice-main">
              <FileAudio :size="20" />
              <span
                ><strong>{{ voice.name }}</strong
                ><small>{{ voice.durationSeconds.toFixed(1) }} 秒 · {{ formatDate(voice.createdAt) }}</small></span
              >
            </div>
            <audio controls preload="metadata" :src="mediaUrl(voice.audioUrl)" @click.stop />
            <n-button
              class="saved-voice-select"
              size="small"
              :type="selectedVoiceId === voice.id ? 'primary' : 'default'"
              :secondary="selectedVoiceId !== voice.id"
              :aria-pressed="selectedVoiceId === voice.id"
              @click.stop="selectedVoiceId = voice.id"
            >
              <Check v-if="selectedVoiceId === voice.id" :size="16" />
              {{ selectedVoiceId === voice.id ? "已选择" : "选择音色" }}
            </n-button>
            <n-button
              circle
              quaternary
              size="small"
              type="error"
              title="永久删除该音色"
              @click.stop="removeSavedVoice(voice.id)"
            >
              <Trash2 :size="16" />
            </n-button>
          </article>
          <n-empty v-if="!languageSavedVoices.length" description="当前语言还没有永久保存的参考音色" />
        </div>

        <div class="panel-heading batch-heading">
          <div>
            <h3>有序文案</h3>
            <p>每段生成一个独立 MP3；拖动卡片或使用箭头调整总 SRT 顺序。</p>
          </div>
          <span :class="{ 'is-limit': totalCharacters > maxBatchTextLength }">
            {{ segments.length }} / {{ maxBatchSegments }} 段 · {{ totalCharacters }} / {{ maxBatchTextLength }} 字符
          </span>
        </div>

        <div class="batch-toolbar">
          <n-input v-model:value="batchName" maxlength="100" clearable placeholder="批次名称（可选）" />
          <n-button secondary @click="openAutoSegment"><WandSparkles :size="16" />智能识别分段</n-button>
          <n-button secondary @click="splitByBlankLines"><SplitSquareVertical :size="16" />按空行拆分</n-button>
          <n-button secondary :disabled="segments.length >= maxBatchSegments" @click="addSegment">
            <Plus :size="16" />添加一段
          </n-button>
        </div>

        <div class="segment-editor-list">
          <article
            v-for="(segment, index) in segments"
            :key="segment.id"
            class="segment-editor-card"
            @dragover="allowSegmentDrop"
            @drop="dropSegment($event, segment.id)"
          >
            <div
              class="segment-order"
              draggable="true"
              title="按住拖动调整顺序"
              @dragstart="startSegmentDrag($event, segment.id)"
              @dragend="dragItemId = undefined"
            >
              <GripVertical :size="17" /><strong>{{ String(index + 1).padStart(2, "0") }}</strong>
            </div>
            <div class="segment-fields">
              <n-input
                v-model:value="segment.text"
                type="textarea"
                :maxlength="maxTextLength"
                show-count
                :autosize="{ minRows: 4, maxRows: 10 }"
                :placeholder="`输入第 ${index + 1} 段 ${languageLabel(language)} 文案…`"
              />
              <n-input
                v-model:value="segment.referenceTranslation"
                type="textarea"
                :maxlength="maxReferenceTranslationLength"
                show-count
                :autosize="{ minRows: 2, maxRows: 6 }"
                placeholder="中文翻译（生成单独的中文 SRT，不参与配音）"
              />
              <n-input v-model:value="segment.fileName" maxlength="100" clearable placeholder="该段文件名（可选）" />
            </div>
            <div class="segment-actions">
              <n-button
                circle
                quaternary
                size="small"
                title="上移"
                :disabled="index === 0"
                @click="moveSegment(index, -1)"
              >
                <ArrowUp :size="16" />
              </n-button>
              <n-button
                circle
                quaternary
                size="small"
                title="下移"
                :disabled="index === segments.length - 1"
                @click="moveSegment(index, 1)"
              >
                <ArrowDown :size="16" />
              </n-button>
              <n-button
                circle
                quaternary
                size="small"
                title="复制"
                :disabled="segments.length >= maxBatchSegments"
                @click="duplicateSegment(index)"
              >
                <Copy :size="16" />
              </n-button>
              <n-button
                circle
                quaternary
                size="small"
                type="error"
                title="删除"
                :disabled="segments.length === 1"
                @click="removeEditorSegment(index)"
              >
                <Trash2 :size="16" />
              </n-button>
            </div>
          </article>
        </div>
      </div>

      <aside class="edge-tts-controls chatterbox-controls">
        <div class="control-section">
          <label>目标语言</label>
          <div class="edge-tts-language-grid chatterbox-language-grid">
            <button type="button" :class="{ active: language === 'ms' }" @click="language = 'ms'">
              <strong>Bahasa Melayu</strong><span>马来语</span>
            </button>
            <button type="button" :class="{ active: language === 'en' }" @click="language = 'en'">
              <strong>English</strong><span>英语</span>
            </button>
            <button type="button" :class="{ active: language === 'pt-BR' }" @click="language = 'pt-BR'">
              <strong>Português BR</strong><span>巴西葡萄牙语</span>
            </button>
          </div>
          <p v-if="language === 'pt-BR'" class="chatterbox-language-hint">
            请使用已获授权的巴西葡语参考录音并输入葡语文案。模型使用通用葡萄牙语，口音由参考录音引导，不会自动翻译。
          </p>
        </div>

        <div class="control-section">
          <div class="control-label-row">
            <label>生成参数</label
            ><n-button text type="primary" size="tiny" @click="resetParameters">恢复默认</n-button>
          </div>
          <label class="range-control"
            ><span
              >情绪强度 <strong>{{ exaggeration.toFixed(2) }}</strong></span
            ><n-slider v-model:value="exaggeration" :min="0.25" :max="1.5" :step="0.05" :tooltip="false"
          /></label>
          <label class="range-control"
            ><span
              >音色遵循 <strong>{{ cfgWeight.toFixed(2) }}</strong></span
            ><n-slider v-model:value="cfgWeight" :min="0" :max="1" :step="0.05" :tooltip="false"
          /></label>
          <label class="range-control"
            ><span
              >随机度 <strong>{{ temperature.toFixed(2) }}</strong></span
            ><n-slider v-model:value="temperature" :min="0.1" :max="1.5" :step="0.05" :tooltip="false"
          /></label>
          <label class="chatterbox-seed"
            ><span>随机种子</span><n-input-number v-model:value="seed" :min="0" :max="2147483647" :precision="0"
          /></label>
        </div>

        <div class="control-section chatterbox-consent">
          <label>声音来源</label>
          <n-select v-model:value="authorization" :options="authorizationOptions" />
          <n-checkbox v-model:checked="consentConfirmed" class="chatterbox-consent-checkbox">
            我确认拥有合法使用与克隆该声音的权利，不用于冒充、欺诈或误导。
          </n-checkbox>
        </div>

        <div class="control-section">
          <label>字幕分段方式</label>
          <n-select v-model:value="subtitleMode" :options="subtitleModeOptions" />
          <n-checkbox v-model:checked="includeSubtitles">生成总 SRT；填写中文时同时生成中文与双语 SRT</n-checkbox>
          <n-checkbox v-model:checked="referenceRetained">保留标准化参考音色 3 天，支持一键重新生成</n-checkbox>
        </div>

        <n-button
          type="primary"
          size="large"
          block
          :loading="creating || isCurrentRunning"
          :disabled="!canCreate"
          @click="createBatch"
        >
          <template #icon><Layers3 :size="18" /></template>
          {{ isCurrentRunning ? `批量生成中 ${currentBatch?.progress || 0}%` : `批量生成 ${validSegmentCount} 个音频` }}
        </n-button>
        <p v-if="!referenceRetained" class="chatterbox-hint">
          批次结束后会删除参考音色；以后重新生成单段时需要再次上传。
        </p>
        <p v-if="!health?.available" class="edge-tts-error">
          请运行 <code>scripts\setup-chatterbox.ps1 -DownloadModel</code>，然后重新一键启动。
        </p>
        <p v-if="errorMessage" class="edge-tts-error">{{ errorMessage }}</p>
      </aside>
    </section>

    <section v-if="currentBatch" class="edge-tts-result" :class="`status-${currentBatch.status}`">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">LATEST BATCH</p>
          <h3>{{ batchTitle(currentBatch) }}</h3>
          <p>
            {{ batchStatusLabel(currentBatch.status) }} · {{ currentBatch.completedItems }}/{{
              currentBatch.items.length
            }}
            完成 · {{ formatDuration(currentBatch.totalAudioDurationSeconds) }}
          </p>
        </div>
        <n-tag :type="batchTagType(currentBatch.status)">{{ batchStatusLabel(currentBatch.status) }}</n-tag>
      </div>
      <div v-if="isCurrentRunning" class="edge-tts-progress">
        <span :style="{ width: `${Math.max(4, currentBatch.progress)}%` }" />
      </div>
      <div class="edge-tts-result-actions">
        <n-button secondary @click="openBatch(currentBatch.id)"><ListTree :size="17" />查看详情</n-button>
        <a v-if="currentBatch.archiveUrl" class="download-button primary" :href="mediaUrl(currentBatch.archiveUrl)"
          ><Archive :size="17" />下载全部 ZIP</a
        >
        <a v-if="currentBatch.combinedAudioUrl" class="download-button" :href="mediaUrl(currentBatch.combinedAudioUrl)"
          ><FileAudio :size="17" />下载总音频</a
        >
        <a v-if="currentBatch.subtitleUrl" class="download-button" :href="mediaUrl(currentBatch.subtitleUrl)"
          ><Captions :size="17" />下载原文 SRT</a
        >
        <a
          v-if="currentBatch.translationSubtitleUrl"
          class="download-button"
          :href="mediaUrl(currentBatch.translationSubtitleUrl)"
          ><Languages :size="17" />下载中文 SRT</a
        >
        <a
          v-if="currentBatch.bilingualSubtitleUrl"
          class="download-button"
          :href="mediaUrl(currentBatch.bilingualSubtitleUrl)"
          ><Languages :size="17" />下载双语 SRT</a
        >
        <n-button v-if="isCurrentRunning" secondary @click="cancelBatch(currentBatch.id)">取消剩余</n-button>
      </div>
    </section>

    <section class="edge-tts-history">
      <div class="panel-heading">
        <div>
          <h3>声音克隆批次</h3>
          <p>音频、总字幕和可选参考音色保留 {{ health?.retentionDays || 3 }} 天。</p>
        </div>
        <n-button secondary :loading="loadingBatches" @click="loadBatches"><RefreshCw :size="16" />刷新</n-button>
      </div>
      <div v-if="batchHistory.batches.length" class="edge-tts-history-list batch-history-list">
        <article v-for="batch in batchHistory.batches" :key="batch.id">
          <div class="history-main">
            <div class="voice-avatar"><Layers3 :size="18" /></div>
            <div>
              <strong>{{ batchTitle(batch) }}</strong>
              <p>
                {{
                  batch.itemPreviews
                    .map((item) => item.textPreview)
                    .slice(0, 2)
                    .join(" / ")
                }}
              </p>
              <span
                >{{ languageLabel(batch.language) }} · {{ batch.completedItems }}/{{ batch.itemPreviews.length }} 完成 ·
                {{ formatDate(batch.createdAt) }}</span
              >
            </div>
          </div>
          <div class="history-actions">
            <n-button circle quaternary size="small" title="查看详情" @click="openBatch(batch.id)"
              ><ListTree :size="17"
            /></n-button>
            <a v-if="batch.archiveUrl" :href="mediaUrl(batch.archiveUrl)" title="下载全部"><Archive :size="17" /></a>
            <a v-if="batch.combinedAudioUrl" :href="mediaUrl(batch.combinedAudioUrl)" title="下载总音频"
              ><FileAudio :size="17"
            /></a>
            <a v-if="batch.subtitleUrl" :href="mediaUrl(batch.subtitleUrl)" title="下载原文 SRT"
              ><Captions :size="17"
            /></a>
            <a v-if="batch.translationSubtitleUrl" :href="mediaUrl(batch.translationSubtitleUrl)" title="下载中文 SRT"
              ><Languages :size="17"
            /></a>
            <a v-if="batch.bilingualSubtitleUrl" :href="mediaUrl(batch.bilingualSubtitleUrl)" title="下载双语 SRT"
              ><Languages :size="17"
            /></a>
            <n-button circle quaternary size="small" type="error" title="删除批次" @click="removeBatch(batch.id)"
              ><Trash2 :size="17"
            /></n-button>
          </div>
        </article>
      </div>
      <n-empty v-else-if="!loadingBatches" description="还没有批量声音克隆记录" />
    </section>

    <details v-if="legacyHistory.tasks.length" class="legacy-clone-history">
      <summary>旧版单段声音克隆记录（{{ legacyHistory.tasks.length }}）</summary>
      <div class="edge-tts-history-list">
        <article v-for="task in legacyHistory.tasks" :key="task.id">
          <div class="history-main">
            <div class="voice-avatar"><Mic2 :size="18" /></div>
            <div>
              <strong>{{ task.fileName || `克隆语音 ${task.id.slice(0, 6)}` }}</strong>
              <p>{{ task.textPreview }}</p>
              <span>{{ formatDate(task.createdAt) }} · {{ taskStatusLabel(task.status) }}</span>
            </div>
          </div>
          <div class="history-actions">
            <a v-if="task.downloadUrl" :href="mediaUrl(task.downloadUrl)" title="下载 MP3"><Download :size="17" /></a
            ><a v-if="task.subtitleUrl" :href="mediaUrl(task.subtitleUrl)" title="下载 SRT"><Captions :size="17" /></a
            ><n-button circle quaternary size="small" title="转为新批次编辑" @click="reuseLegacy(task.id)"
              ><RotateCcw :size="17" /></n-button
            ><n-button circle quaternary size="small" type="error" title="删除" @click="removeLegacy(task.id)"
              ><Trash2 :size="17"
            /></n-button>
          </div>
        </article>
      </div>
    </details>

    <n-modal v-model:show="autoSegmentVisible">
      <n-card class="auto-segment-card" title="智能识别分段" closable @close="autoSegmentVisible = false">
        <p class="auto-segment-help">
          粘贴带编号的双语文案，系统会将每个编号识别为一段，并自动区分目标语言原文和中文翻译。
        </p>
        <n-input
          v-model:value="autoSegmentText"
          type="textarea"
          :autosize="{ minRows: 12, maxRows: 20 }"
          placeholder="例如：&#10;1. **Malay / English / Português 原文**\&#10;   中文翻译&#10;2. **下一段原文**\&#10;   下一段中文翻译"
        />
        <div v-if="autoSegmentText.trim()" class="auto-segment-summary">
          <strong v-if="parsedAutoSegments.length">
            已识别 {{ parsedAutoSegments.length }} 段 · {{ translatedAutoSegmentCount }} 段包含中文翻译
          </strong>
          <strong v-else class="is-error">暂未识别到有效文案</strong>
          <ol v-if="parsedAutoSegments.length" class="auto-segment-preview">
            <li v-for="(segment, index) in parsedAutoSegments" :key="`${index}-${segment.text}`">
              <strong class="auto-segment-index">{{ index + 1 }}.</strong>
              <div>
                <span>{{ segment.text }}</span>
                <small>{{ segment.referenceTranslation || "未识别到中文翻译" }}</small>
              </div>
            </li>
          </ol>
        </div>
        <template #footer>
          <div class="auto-segment-actions">
            <n-button @click="autoSegmentVisible = false">取消</n-button>
            <n-button type="primary" :disabled="!parsedAutoSegments.length" @click="applyAutoSegments">
              识别并填入 {{ parsedAutoSegments.length || "" }} 段
            </n-button>
          </div>
        </template>
      </n-card>
    </n-modal>

    <n-modal v-model:show="detailVisible">
      <n-card
        class="batch-detail-card"
        :title="detailBatch ? batchTitle(detailBatch) : '批次详情'"
        closable
        @close="detailVisible = false"
      >
        <template v-if="detailBatch">
          <div class="batch-detail-summary">
            <span>{{ batchStatusLabel(detailBatch.status) }}</span
            ><span>{{ detailBatch.completedItems }}/{{ detailBatch.items.length }} 完成</span
            ><span>总时长 {{ formatDuration(detailBatch.totalAudioDurationSeconds) }}</span
            ><span>参考音色：{{ detailBatch.referenceAvailable ? "可用于重生成" : "已删除" }}</span>
          </div>
          <div class="edge-tts-result-actions detail-top-actions">
            <a v-if="detailBatch.archiveUrl" class="download-button primary" :href="mediaUrl(detailBatch.archiveUrl)"
              ><Archive :size="17" />下载全部 ZIP</a
            >
            <a
              v-if="detailBatch.combinedAudioUrl"
              class="download-button"
              :href="mediaUrl(detailBatch.combinedAudioUrl)"
              ><FileAudio :size="17" />下载总音频</a
            >
            <a v-if="detailBatch.subtitleUrl" class="download-button" :href="mediaUrl(detailBatch.subtitleUrl)"
              ><Captions :size="17" />下载原文 SRT</a
            >
            <a
              v-if="detailBatch.translationSubtitleUrl"
              class="download-button"
              :href="mediaUrl(detailBatch.translationSubtitleUrl)"
              ><Languages :size="17" />下载中文 SRT</a
            >
            <a
              v-if="detailBatch.bilingualSubtitleUrl"
              class="download-button"
              :href="mediaUrl(detailBatch.bilingualSubtitleUrl)"
              ><Languages :size="17" />下载双语 SRT</a
            >
            <n-button
              v-if="detailBatch.referenceAvailable && !isBatchRunning(detailBatch)"
              secondary
              @click="removeReference(detailBatch.id)"
              >提前删除参考音色</n-button
            >
          </div>
          <div class="retry-reference">
            <span>{{
              detailBatch.referenceAvailable
                ? "重生成参考音色（不选则沿用）"
                : "原参考音色已删除，请选择永久音色或重新上传"
            }}</span>
            <n-select v-model:value="retryVoiceId" :options="retryVoiceOptions" />
            <input
              ref="retryReferenceInput"
              hidden
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.flac"
              @change="selectRetryReference"
            />
            <n-button secondary @click="retryReferenceInput?.click()">
              <UploadCloud :size="16" />{{ retryReference?.name || "上传新参考音色" }}
            </n-button>
          </div>
          <div class="batch-detail-items">
            <article v-for="(item, index) in orderedDetailItems" :key="item.id" class="batch-detail-item">
              <header>
                <strong>{{ String(index + 1).padStart(2, "0") }} · {{ item.fileName || `segment-${index + 1}` }}</strong
                ><n-tag :type="taskTagType(item.status)" size="small">{{ taskStatusLabel(item.status) }}</n-tag>
              </header>
              <n-input
                v-model:value="itemDrafts[item.id].text"
                type="textarea"
                :maxlength="maxTextLength"
                show-count
                :autosize="{ minRows: 3, maxRows: 8 }"
              />
              <n-input
                v-model:value="itemDrafts[item.id].referenceTranslation"
                type="textarea"
                :maxlength="maxReferenceTranslationLength"
                show-count
                :autosize="{ minRows: 2, maxRows: 6 }"
                placeholder="中文翻译（生成单独的中文 SRT，不参与配音）"
              />
              <div class="detail-item-fields">
                <n-input
                  v-model:value="itemDrafts[item.id].fileName"
                  maxlength="100"
                  placeholder="文件名"
                /><n-input-number
                  v-model:value="itemDrafts[item.id].seed"
                  :min="0"
                  :max="2147483647"
                  :precision="0"
                  placeholder="随机种子"
                />
              </div>
              <div class="detail-item-parameters">
                <label
                  >情绪强度<n-input-number
                    v-model:value="itemDrafts[item.id].exaggeration"
                    :min="0.25"
                    :max="1.5"
                    :step="0.05"
                /></label>
                <label
                  >音色遵循<n-input-number v-model:value="itemDrafts[item.id].cfgWeight" :min="0" :max="1" :step="0.05"
                /></label>
                <label
                  >随机度<n-input-number
                    v-model:value="itemDrafts[item.id].temperature"
                    :min="0.1"
                    :max="1.5"
                    :step="0.05"
                /></label>
              </div>
              <audio
                v-if="item.audioUrl"
                class="edge-tts-player"
                controls
                preload="metadata"
                :src="mediaUrl(item.audioUrl)"
              />
              <p v-if="item.error" class="edge-tts-error">{{ item.error }}</p>
              <div class="detail-item-actions">
                <n-button
                  size="small"
                  :disabled="index === 0 || isBatchRunning(detailBatch)"
                  @click="moveDetailItem(index, -1)"
                  ><ArrowUp :size="15" />上移</n-button
                >
                <n-button
                  size="small"
                  :disabled="index === orderedDetailItems.length - 1 || isBatchRunning(detailBatch)"
                  @click="moveDetailItem(index, 1)"
                  ><ArrowDown :size="15" />下移</n-button
                >
                <a v-if="item.downloadUrl" class="download-button compact" :href="mediaUrl(item.downloadUrl)"
                  ><Download :size="15" />下载</a
                >
                <n-button
                  size="small"
                  type="primary"
                  :loading="regeneratingItemId === item.id"
                  :disabled="item.status === 'queued' || item.status === 'processing'"
                  @click="regenerateItem(item.id)"
                  ><RotateCcw :size="15" />重新生成</n-button
                >
                <n-button
                  size="small"
                  type="error"
                  secondary
                  :disabled="orderedDetailItems.length <= 1 || item.status === 'processing'"
                  @click="removeBatchItem(item.id)"
                  ><Trash2 :size="15" />删除</n-button
                >
              </div>
            </article>
          </div>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { NButton, NCard, NCheckbox, NEmpty, NInput, NInputNumber, NModal, NSelect, NSlider, NTag } from "naive-ui";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Captions,
  Check,
  Copy,
  Download,
  FileAudio,
  GripVertical,
  Layers3,
  Languages,
  Library,
  ListTree,
  Mic2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SplitSquareVertical,
  Trash2,
  UploadCloud,
  WandSparkles
} from "lucide-vue-next";
import { useChatterboxPanel } from "./useChatterboxPanel";

const {
  maxTextLength,
  maxReferenceTranslationLength,
  maxBatchSegments,
  maxBatchTextLength,
  authorizationOptions,
  subtitleModeOptions,
  health,
  referenceFile,
  referencePreview,
  retryReference,
  retryReferenceInput,
  referenceSource,
  savedVoices,
  selectedVoiceId,
  retryVoiceId,
  voiceName,
  savingVoice,
  batchName,
  segments,
  autoSegmentVisible,
  autoSegmentText,
  language,
  authorization,
  consentConfirmed,
  exaggeration,
  cfgWeight,
  temperature,
  seed,
  includeSubtitles,
  subtitleMode,
  referenceRetained,
  creating,
  loadingBatches,
  currentBatch,
  batchHistory,
  legacyHistory,
  detailBatch,
  detailVisible,
  regeneratingItemId,
  itemDrafts,
  errorMessage,
  dragItemId,
  totalCharacters,
  validSegmentCount,
  parsedAutoSegments,
  translatedAutoSegmentCount,
  isCurrentRunning,
  canCreate,
  healthLabel,
  orderedDetailItems,
  languageSavedVoices,
  retryVoiceOptions,
  addSegment,
  duplicateSegment,
  removeEditorSegment,
  moveSegment,
  startSegmentDrag,
  allowSegmentDrop,
  dropSegment,
  splitByBlankLines,
  openAutoSegment,
  applyAutoSegments,
  selectReference,
  selectRetryReference,
  saveCurrentVoice,
  removeSavedVoice,
  loadBatches,
  createBatch,
  openBatch,
  regenerateItem,
  moveDetailItem,
  removeBatchItem,
  cancelBatch,
  removeReference,
  removeBatch,
  reuseLegacy,
  removeLegacy,
  resetParameters,
  isBatchRunning,
  languageLabel,
  batchTitle,
  batchStatusLabel,
  batchTagType,
  taskStatusLabel,
  taskTagType,
  formatDate,
  formatDuration,
  formatBytes,
  mediaUrl
} = useChatterboxPanel();
</script>

<style scoped src="./ChatterboxPanel.css"></style>
