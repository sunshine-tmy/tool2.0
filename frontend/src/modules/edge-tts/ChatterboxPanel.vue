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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import {
  NButton,
  NCard,
  NCheckbox,
  NEmpty,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSlider,
  NTag,
  useMessage
} from "naive-ui";
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
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import {
  CHATTERBOX_MAX_BATCH_SEGMENTS,
  CHATTERBOX_MAX_BATCH_TEXT_LENGTH,
  CHATTERBOX_MAX_REFERENCE_BYTES,
  CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH,
  CHATTERBOX_MAX_TEXT_LENGTH,
  type ChatterboxBatch,
  type ChatterboxBatchStatus,
  type ChatterboxBatchList,
  type ChatterboxHealth,
  type ChatterboxLanguage,
  type ChatterboxSavedVoice,
  type ChatterboxSubtitleMode,
  type ChatterboxTaskList,
  type ChatterboxTaskStatus,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import { resolveBackendUrl } from "../../config/runtime";
import { createLocalId } from "../../utils/local-id";
import { chatterboxApi } from "./chatterbox-api";
import { parseChatterboxSegments } from "./chatterbox-segment-parser";

type EditorSegment = { id: string; text: string; referenceTranslation: string; fileName: string };
type ItemDraft = {
  text: string;
  referenceTranslation: string;
  fileName: string;
  seed: number;
  exaggeration: number;
  cfgWeight: number;
  temperature: number;
};

const message = useMessage();
const confirmAction = useConfirmDialog();
const maxTextLength = CHATTERBOX_MAX_TEXT_LENGTH;
const maxReferenceTranslationLength = CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH;
const maxBatchSegments = CHATTERBOX_MAX_BATCH_SEGMENTS;
const maxBatchTextLength = CHATTERBOX_MAX_BATCH_TEXT_LENGTH;
const authorizationOptions = [
  { label: "这是我本人的声音", value: "self" },
  { label: "已取得声音所有者明确授权", value: "authorized" }
];
const subtitleModeOptions = [
  { label: "段内按完整句子分段（推荐）", value: "sentences" },
  { label: "每段文案一个字幕块", value: "segments" }
];
const health = ref<ChatterboxHealth>();
const referenceFile = ref<File>();
const referencePreview = ref("");
const retryReference = ref<File>();
const retryReferenceInput = ref<HTMLInputElement>();
const referenceSource = ref<"upload" | "saved">("upload");
const savedVoices = ref<ChatterboxSavedVoice[]>([]);
const selectedVoiceId = ref("");
const retryVoiceId = ref("");
const voiceName = ref("");
const savingVoice = ref(false);
const batchName = ref("");
const segments = ref<EditorSegment[]>([newEditorSegment()]);
const autoSegmentVisible = ref(false);
const autoSegmentText = ref("");
const language = ref<ChatterboxLanguage>("ms");
const authorization = ref<ChatterboxVoiceAuthorization>("self");
const consentConfirmed = ref(false);
const exaggeration = ref(0.5);
const cfgWeight = ref(0.5);
const temperature = ref(0.8);
const seed = ref(0);
const includeSubtitles = ref(true);
const subtitleMode = ref<ChatterboxSubtitleMode>("sentences");
const referenceRetained = ref(false);
const creating = ref(false);
const loadingBatches = ref(false);
const currentBatch = ref<ChatterboxBatch>();
const batchHistory = ref<ChatterboxBatchList>({
  batches: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
});
const legacyHistory = ref<ChatterboxTaskList>({
  tasks: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
});
const detailBatch = ref<ChatterboxBatch>();
const detailVisible = ref(false);
const regeneratingItemId = ref<string>();
const itemDrafts = reactive<Record<string, ItemDraft>>({});
const errorMessage = ref("");
const dragItemId = ref<string>();
let pollTimer: ReturnType<typeof setTimeout> | undefined;

const totalCharacters = computed(() => segments.value.reduce((sum, item) => sum + item.text.length, 0));
const validSegmentCount = computed(() => segments.value.filter((item) => item.text.trim()).length);
const parsedAutoSegments = computed(() => parseChatterboxSegments(autoSegmentText.value));
const translatedAutoSegmentCount = computed(
  () => parsedAutoSegments.value.filter((item) => item.referenceTranslation).length
);
const isCurrentRunning = computed(() => currentBatch.value && isBatchRunning(currentBatch.value));
const hasSelectedReference = computed(() =>
  referenceSource.value === "upload"
    ? Boolean(referenceFile.value)
    : languageSavedVoices.value.some((voice) => voice.id === selectedVoiceId.value)
);
const canCreate = computed(() =>
  Boolean(
    health.value?.available &&
    hasSelectedReference.value &&
    consentConfirmed.value &&
    segments.value.every((item) => item.text.trim() && item.text.length <= maxTextLength) &&
    segments.value.every((item) => item.referenceTranslation.length <= maxReferenceTranslationLength) &&
    totalCharacters.value <= maxBatchTextLength &&
    !isCurrentRunning.value
  )
);
const healthLabel = computed(() =>
  !health.value?.available
    ? "克隆环境未就绪"
    : health.value.modelLoaded
      ? `V3 已加载 · ${health.value.gpuName || health.value.device?.toUpperCase() || "本机"}`
      : "V3 待加载"
);
const orderedDetailItems = computed(() =>
  detailBatch.value ? [...detailBatch.value.items].sort((a, b) => a.order - b.order) : []
);
const languageSavedVoices = computed(() => savedVoices.value.filter((voice) => voice.language === language.value));
const retryVoiceOptions = computed(() => [
  {
    label: detailBatch.value?.referenceAvailable ? "沿用当前参考音色" : "选择永久参考音色",
    value: ""
  },
  ...savedVoices.value
    .filter((voice) => voice.language === detailBatch.value?.language)
    .map((voice) => ({ label: `${voice.name} · ${voice.durationSeconds.toFixed(1)} 秒`, value: voice.id }))
]);

onMounted(() => void Promise.all([loadHealth(), loadBatches(), loadLegacyHistory(), loadSavedVoices()]));
watch(language, () => {
  if (referenceSource.value !== "saved") return;
  if (!languageSavedVoices.value.some((voice) => voice.id === selectedVoiceId.value)) {
    selectedVoiceId.value = languageSavedVoices.value[0]?.id || "";
  }
});
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer);
  revokePreview();
});

function newEditorSegment(text = "", fileName = "", referenceTranslation = ""): EditorSegment {
  return { id: createLocalId("chatterbox-segment"), text, referenceTranslation, fileName };
}
function addSegment() {
  if (segments.value.length < maxBatchSegments) segments.value.push(newEditorSegment());
}
function duplicateSegment(index: number) {
  if (segments.value.length < maxBatchSegments)
    segments.value.splice(
      index + 1,
      0,
      newEditorSegment(
        segments.value[index].text,
        segments.value[index].fileName,
        segments.value[index].referenceTranslation
      )
    );
}
function removeEditorSegment(index: number) {
  if (segments.value.length > 1) segments.value.splice(index, 1);
}
function moveSegment(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= segments.value.length) return;
  const [item] = segments.value.splice(index, 1);
  segments.value.splice(target, 0, item);
}
function startSegmentDrag(event: DragEvent, segmentId: string) {
  dragItemId.value = segmentId;
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", segmentId);
}
function allowSegmentDrop(event: DragEvent) {
  if (!dragItemId.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
}
function dropSegment(event: DragEvent, targetId: string) {
  if (!dragItemId.value) return;
  event.preventDefault();
  const source = segments.value.findIndex((item) => item.id === dragItemId.value);
  const target = segments.value.findIndex((item) => item.id === targetId);
  if (source >= 0 && target >= 0 && source !== target) {
    const [item] = segments.value.splice(source, 1);
    segments.value.splice(target, 0, item);
  }
  dragItemId.value = undefined;
}
function splitByBlankLines() {
  const expanded = segments.value.flatMap((item) =>
    item.text
      .split(/\r?\n\s*\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) =>
        newEditorSegment(text, index === 0 ? item.fileName : "", index === 0 ? item.referenceTranslation : "")
      )
  );
  if (!expanded.length) return message.warning("请先输入需要拆分的文案");
  if (expanded.length > maxBatchSegments) return message.error(`按空行拆分后超过 ${maxBatchSegments} 段`);
  segments.value = expanded;
  message.success(`已拆分为 ${expanded.length} 段`);
}

function openAutoSegment() {
  autoSegmentVisible.value = true;
}

async function applyAutoSegments() {
  const parsed = parsedAutoSegments.value;
  if (!parsed.length) return message.warning("没有识别到有效文案");
  if (parsed.length > maxBatchSegments) return message.error(`识别结果超过 ${maxBatchSegments} 段，请删减后重试`);
  if (parsed.some((item) => item.text.length > maxTextLength)) {
    return message.error(`存在超过 ${maxTextLength} 字符的原文段落，请拆短后重试`);
  }
  if (parsed.some((item) => item.referenceTranslation.length > maxReferenceTranslationLength)) {
    return message.error(`存在超过 ${maxReferenceTranslationLength} 字符的中文翻译，请拆短后重试`);
  }
  const parsedCharacters = parsed.reduce((sum, item) => sum + item.text.length, 0);
  if (parsedCharacters > maxBatchTextLength) {
    return message.error(`识别结果共 ${parsedCharacters} 字符，超过批次上限 ${maxBatchTextLength}`);
  }

  const hasExistingContent = segments.value.some(
    (item) => item.text.trim() || item.referenceTranslation.trim() || item.fileName.trim()
  );
  if (
    hasExistingContent &&
    !(await confirmAction(`识别到 ${parsed.length} 段，填入后会覆盖当前文案。是否继续？`, {
      title: "覆盖当前分段",
      positiveText: "覆盖并填入",
      danger: false
    }))
  ) {
    return;
  }

  segments.value = parsed.map((item) => newEditorSegment(item.text, "", item.referenceTranslation));
  autoSegmentVisible.value = false;
  message.success(`已自动识别并填入 ${parsed.length} 段文案`);
}

function selectReference(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > CHATTERBOX_MAX_REFERENCE_BYTES) return message.error("参考音频不能超过 20 MB");
  revokePreview();
  referenceFile.value = file;
  referenceSource.value = "upload";
  referencePreview.value = URL.createObjectURL(file);
}
function selectRetryReference(event: Event) {
  const input = event.target as HTMLInputElement;
  retryReference.value = input.files?.[0];
  input.value = "";
}
function revokePreview() {
  if (referencePreview.value) URL.revokeObjectURL(referencePreview.value);
  referencePreview.value = "";
}

async function loadSavedVoices() {
  try {
    savedVoices.value = (await chatterboxApi.voices()).voices;
    if (selectedVoiceId.value && !savedVoices.value.some((voice) => voice.id === selectedVoiceId.value)) {
      selectedVoiceId.value = "";
    }
    if (!referenceFile.value && languageSavedVoices.value.length) {
      selectedVoiceId.value ||= languageSavedVoices.value[0].id;
      referenceSource.value = "saved";
    }
  } catch (error) {
    errorMessage.value = readableError(error, "永久参考音色读取失败");
  }
}

async function saveCurrentVoice() {
  if (!referenceFile.value || !voiceName.value.trim() || !consentConfirmed.value) return;
  savingVoice.value = true;
  try {
    const voice = await chatterboxApi.saveVoice({
      reference: referenceFile.value,
      name: voiceName.value.trim(),
      language: language.value,
      authorization: authorization.value,
      consentConfirmed: consentConfirmed.value
    });
    await loadSavedVoices();
    selectedVoiceId.value = voice.id;
    referenceSource.value = "saved";
    voiceName.value = "";
    message.success("参考音色已永久保存");
  } catch (error) {
    message.error(readableError(error, "永久保存参考音色失败"));
  } finally {
    savingVoice.value = false;
  }
}

async function removeSavedVoice(voiceId: string) {
  if (!(await confirmAction("永久删除该参考音色？已经生成的音频不会受影响。", { title: "删除参考音色" }))) return;
  try {
    await chatterboxApi.removeVoice(voiceId);
    if (selectedVoiceId.value === voiceId) selectedVoiceId.value = "";
    if (retryVoiceId.value === voiceId) retryVoiceId.value = "";
    await loadSavedVoices();
    message.success("永久参考音色已删除");
  } catch (error) {
    message.error(readableError(error, "删除永久参考音色失败"));
  }
}

async function loadHealth() {
  try {
    health.value = await chatterboxApi.health();
  } catch (error) {
    errorMessage.value = readableError(error, "无法读取声音克隆服务状态");
  }
}
async function loadBatches() {
  loadingBatches.value = true;
  try {
    batchHistory.value = await chatterboxApi.batches(1, 10);
  } catch (error) {
    errorMessage.value = readableError(error, "批次记录读取失败");
  } finally {
    loadingBatches.value = false;
  }
}
async function loadLegacyHistory() {
  try {
    legacyHistory.value = await chatterboxApi.list(1, 10);
  } catch {
    /* Legacy history is optional. */
  }
}

async function createBatch() {
  if (!canCreate.value) return;
  creating.value = true;
  errorMessage.value = "";
  try {
    currentBatch.value = await chatterboxApi.createBatch({
      reference: referenceSource.value === "upload" ? referenceFile.value : undefined,
      voiceId: referenceSource.value === "saved" ? selectedVoiceId.value : undefined,
      segments: segments.value.map((item) => ({
        text: item.text.trim(),
        referenceTranslation: item.referenceTranslation.trim() || undefined,
        fileName: item.fileName.trim() || undefined
      })),
      name: batchName.value.trim() || undefined,
      language: language.value,
      authorization: authorization.value,
      consentConfirmed: consentConfirmed.value,
      exaggeration: exaggeration.value,
      cfgWeight: cfgWeight.value,
      temperature: temperature.value,
      seed: seed.value || 0,
      includeSubtitles: includeSubtitles.value,
      subtitleMode: subtitleMode.value,
      referenceRetained: referenceRetained.value
    });
    message.success("批次已加入生成队列");
    schedulePoll();
    await loadBatches();
  } catch (error) {
    errorMessage.value = readableError(error, "声音克隆批次创建失败");
  } finally {
    creating.value = false;
  }
}

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer);
  if (!currentBatch.value || !isBatchRunning(currentBatch.value)) return;
  pollTimer = setTimeout(async () => {
    try {
      if (!currentBatch.value) return;
      currentBatch.value = await chatterboxApi.batch(currentBatch.value.id);
      if (detailBatch.value?.id === currentBatch.value.id) setDetailBatch(currentBatch.value);
      if (!isBatchRunning(currentBatch.value)) {
        message[currentBatch.value.status === "completed" ? "success" : "warning"](
          currentBatch.value.status === "completed" ? "批量声音克隆生成完成" : "批次已结束，请查看失败文案段"
        );
        await loadBatches();
      }
    } catch (error) {
      errorMessage.value = readableError(error, "批次状态读取失败");
    } finally {
      schedulePoll();
    }
  }, 1500);
}

async function openBatch(id: string) {
  try {
    const batch = await chatterboxApi.batch(id);
    setDetailBatch(batch);
    if (isBatchRunning(batch)) {
      currentBatch.value = batch;
      schedulePoll();
    }
    detailVisible.value = true;
  } catch (error) {
    message.error(readableError(error, "批次详情读取失败"));
  }
}
function setDetailBatch(batch: ChatterboxBatch) {
  detailBatch.value = batch;
  for (const item of batch.items)
    itemDrafts[item.id] = {
      text: item.text,
      referenceTranslation: item.referenceTranslation || "",
      fileName: item.fileName || "",
      seed: item.seed ?? batch.seed,
      exaggeration: item.exaggeration ?? batch.exaggeration,
      cfgWeight: item.cfgWeight ?? batch.cfgWeight,
      temperature: item.temperature ?? batch.temperature
    };
}
async function refreshDetail() {
  if (detailBatch.value) setDetailBatch(await chatterboxApi.batch(detailBatch.value.id));
  await loadBatches();
}

async function regenerateItem(itemId: string) {
  if (!detailBatch.value) return;
  if (!detailBatch.value.referenceAvailable && !retryReference.value && !retryVoiceId.value) {
    return message.warning("请先选择永久参考音色或重新上传音频");
  }
  regeneratingItemId.value = itemId;
  try {
    const draft = itemDrafts[itemId];
    setDetailBatch(
      await chatterboxApi.regenerate(detailBatch.value.id, itemId, {
        text: draft.text.trim(),
        referenceTranslation: draft.referenceTranslation.trim() || undefined,
        fileName: draft.fileName.trim() || undefined,
        seed: draft.seed,
        exaggeration: draft.exaggeration,
        cfgWeight: draft.cfgWeight,
        temperature: draft.temperature,
        reference: retryReference.value,
        voiceId: retryReference.value ? undefined : retryVoiceId.value || undefined
      })
    );
    currentBatch.value = detailBatch.value;
    retryReference.value = undefined;
    retryVoiceId.value = "";
    schedulePoll();
    message.success("该文案段已加入重新生成队列");
  } catch (error) {
    message.error(readableError(error, "重新生成失败"));
  } finally {
    regeneratingItemId.value = undefined;
  }
}
async function moveDetailItem(index: number, delta: number) {
  if (!detailBatch.value) return;
  const ids = orderedDetailItems.value.map((item) => item.id);
  const target = index + delta;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  try {
    setDetailBatch(await chatterboxApi.reorder(detailBatch.value.id, ids));
    await loadBatches();
  } catch (error) {
    message.error(readableError(error, "调整顺序失败"));
  }
}
async function removeBatchItem(itemId: string) {
  if (!detailBatch.value) return;
  if (!(await confirmAction("删除这一段及其音频，并重建总 SRT？", { title: "删除文案段" }))) return;
  try {
    const result = await chatterboxApi.removeBatchItem(detailBatch.value.id, itemId);
    if (result.batch) setDetailBatch(result.batch);
    await loadBatches();
    message.success("文案段已删除");
  } catch (error) {
    message.error(readableError(error, "删除失败"));
  }
}
async function cancelBatch(id: string) {
  if (
    !(await confirmAction("取消尚未开始的文案段？正在生成的一段会继续完成。", {
      title: "取消批次",
      positiveText: "确认取消"
    }))
  )
    return;
  try {
    currentBatch.value = await chatterboxApi.cancelBatch(id);
    await loadBatches();
  } catch (error) {
    message.error(readableError(error, "取消失败"));
  }
}
async function removeReference(id: string) {
  if (!(await confirmAction("提前删除参考音色后，再次生成需要重新上传。确定删除？", { title: "删除参考音色" }))) return;
  try {
    await chatterboxApi.removeBatchReference(id);
    await refreshDetail();
    message.success("参考音色已删除");
  } catch (error) {
    message.error(readableError(error, "删除参考音色失败"));
  }
}
async function removeBatch(id: string) {
  if (!(await confirmAction("删除整个批次、全部音频和总 SRT？", { title: "删除整个批次" }))) return;
  try {
    await chatterboxApi.removeBatch(id);
    if (currentBatch.value?.id === id) currentBatch.value = undefined;
    if (detailBatch.value?.id === id) detailVisible.value = false;
    await loadBatches();
    message.success("批次已删除");
  } catch (error) {
    message.error(readableError(error, "删除批次失败"));
  }
}

async function reuseLegacy(id: string) {
  try {
    const task = await chatterboxApi.task(id);
    segments.value = [newEditorSegment(task.text, task.fileName || "")];
    language.value = task.language;
    authorization.value = task.authorization;
    exaggeration.value = task.exaggeration;
    cfgWeight.value = task.cfgWeight;
    temperature.value = task.temperature;
    seed.value = task.seed;
    includeSubtitles.value = task.includeSubtitles;
    consentConfirmed.value = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    message.info("旧文案已载入，请重新上传参考音色并确认授权");
  } catch (error) {
    message.error(readableError(error, "读取旧记录失败"));
  }
}
async function removeLegacy(id: string) {
  if (!(await confirmAction("删除这条旧版声音克隆记录？", { title: "删除声音克隆记录" }))) return;
  try {
    await chatterboxApi.remove(id);
    await loadLegacyHistory();
  } catch (error) {
    message.error(readableError(error, "删除失败"));
  }
}

function resetParameters() {
  exaggeration.value = 0.5;
  cfgWeight.value = 0.5;
  temperature.value = 0.8;
  seed.value = 0;
}
function isBatchRunning(batch: ChatterboxBatch) {
  return batch.status === "queued" || batch.status === "processing";
}
function languageLabel(value: ChatterboxLanguage) {
  return { ms: "Bahasa Melayu", en: "English", "pt-BR": "巴西葡萄牙语" }[value];
}
function batchTitle(batch: { name?: string; id: string }) {
  return batch.name || `声音批次 ${batch.id.slice(0, 6)}`;
}
function batchStatusLabel(status: ChatterboxBatchStatus) {
  return {
    queued: "排队中",
    processing: "生成中",
    partial_failed: "部分失败",
    completed: "已完成",
    cancelled: "已取消"
  }[status];
}
function batchTagType(status: ChatterboxBatchStatus): "success" | "warning" | "error" | "default" {
  return status === "completed"
    ? "success"
    : status === "partial_failed" || status === "cancelled"
      ? "error"
      : "warning";
}
function taskStatusLabel(status: ChatterboxTaskStatus) {
  return { queued: "排队中", processing: "生成中", completed: "已完成", failed: "失败", cancelled: "已取消" }[status];
}
function taskTagType(status: ChatterboxTaskStatus): "success" | "warning" | "error" | "default" {
  return status === "completed" ? "success" : status === "failed" || status === "cancelled" ? "error" : "warning";
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
function formatDuration(value?: number) {
  if (!value) return "0 秒";
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return minutes ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}
function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}
function mediaUrl(value?: string) {
  return value ? resolveBackendUrl(value) : undefined;
}
function readableError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
</script>

<style scoped>
.chatterbox-language-hint {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.batch-editor {
  min-width: 0;
}
.voice-source-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.voice-source-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface-color);
  cursor: pointer;
}
.voice-source-tabs button.active {
  border-color: #3b82f6;
  color: #2563eb;
  background: #eff6ff;
}
.save-voice-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  margin-top: 10px;
}
.saved-voice-list {
  display: grid;
  gap: 10px;
}
.saved-voice-list article {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, 1fr) auto 36px;
  align-items: center;
  gap: 10px;
  padding: 11px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
}
.saved-voice-list article.selected {
  border-color: #3b82f6;
  background: #f8fbff;
  box-shadow: 0 0 0 2px rgb(59 130 246 / 12%);
}
.saved-voice-main {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  text-align: left;
}
.saved-voice-main span {
  display: grid;
}
.saved-voice-main small {
  color: var(--text-secondary);
}
.saved-voice-list audio {
  width: 100%;
  height: 36px;
}
.saved-voice-select {
  min-width: 88px;
}
.chatterbox-consent-checkbox {
  align-items: flex-start;
}
.chatterbox-consent-checkbox :deep(.n-checkbox__label) {
  line-height: 1.55;
}
.batch-heading {
  margin-top: 24px;
}
.batch-toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto auto auto;
  gap: 10px;
  margin-bottom: 14px;
}
.auto-segment-card {
  width: min(760px, calc(100vw - 32px));
}
.auto-segment-help {
  margin: 0 0 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.auto-segment-summary {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-secondary);
}
.auto-segment-summary strong {
  color: var(--text-primary);
}
.auto-segment-summary .is-error {
  color: var(--error-color);
}
.auto-segment-preview {
  display: grid;
  gap: 8px;
  max-height: min(42vh, 420px);
  margin: 0;
  padding-left: 0;
  padding-right: 8px;
  overflow-y: auto;
  list-style: none;
}
.auto-segment-preview li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 6px;
}
.auto-segment-preview .auto-segment-index {
  color: var(--text-primary);
  text-align: right;
}
.auto-segment-preview li span,
.auto-segment-preview li small {
  display: block;
}
.auto-segment-preview li span {
  color: var(--text-primary);
}
.auto-segment-preview li small {
  margin-top: 2px;
}
.auto-segment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.segment-editor-list,
.batch-detail-items {
  display: grid;
  gap: 12px;
}
.segment-editor-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 36px;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--surface-color);
}
.segment-order {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  cursor: grab;
  user-select: none;
}
.segment-order:active {
  cursor: grabbing;
}
.segment-fields {
  display: grid;
  gap: 9px;
}
.segment-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.batch-history-list article {
  align-items: center;
}
.legacy-clone-history {
  margin-top: 18px;
  padding: 18px;
  border: 1px solid var(--border-color);
  border-radius: 16px;
}
.legacy-clone-history summary {
  cursor: pointer;
  font-weight: 700;
}
.legacy-clone-history .edge-tts-history-list {
  margin-top: 14px;
}
.batch-detail-card {
  width: min(1040px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  overflow: auto;
}
.batch-detail-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-secondary);
}
.detail-top-actions {
  margin: 14px 0;
}
.retry-reference {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(180px, 260px) minmax(200px, 1fr);
  align-items: center;
  gap: 16px;
  padding: 12px;
  margin-bottom: 14px;
  border: 1px dashed var(--warning-color);
  border-radius: 12px;
}
.detail-item-parameters {
  display: grid;
  grid-template-columns: repeat(3, minmax(130px, 1fr));
  gap: 10px;
  margin: 10px 0;
}
.detail-item-parameters label {
  display: grid;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}
.batch-detail-item {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
}
.batch-detail-item header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.detail-item-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 10px;
  margin: 10px 0;
}
.detail-item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.download-button.compact {
  min-height: 34px;
  padding: 0 12px;
}
@media (max-width: 760px) {
  .batch-toolbar {
    grid-template-columns: 1fr 1fr;
  }
  .batch-toolbar > :first-child {
    grid-column: 1 / -1;
  }
  .segment-editor-card {
    grid-template-columns: 38px minmax(0, 1fr);
  }
  .segment-actions {
    grid-column: 2;
    flex-direction: row;
  }
  .detail-item-fields {
    grid-template-columns: 1fr;
  }
  .saved-voice-list article,
  .retry-reference,
  .detail-item-parameters {
    grid-template-columns: 1fr;
  }
  .saved-voice-select {
    width: 100%;
  }
}
</style>
