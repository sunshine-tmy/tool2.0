<template>
  <component
    :is="embedded ? 'section' : NModal"
    v-bind="embedded ? {} : { show, maskClosable: false }"
    @update:show="close"
  >
    <n-card
      :title="isImage ? '图集生成配乐视频' : '视频编辑'"
      class="audio-editor"
      :class="{ 'is-embedded': embedded, 'is-workbench': !isImage }"
      :style="workspace.style.value"
      :closable="!embedded"
      @close="close"
    >
      <n-alert v-if="error || watermarkError" type="error"
        >{{ error || watermarkError
        }}<n-button v-if="activeJob" size="small" @click="schedulePoll(generation)">重试状态</n-button></n-alert
      >
      <n-alert v-if="roughCut.error.value" type="error"
        >{{ roughCut.error.value
        }}<n-button size="small" @click="roughCut.loaded.value ? roughCut.flush() : roughCut.load()"
          >重试工程</n-button
        ></n-alert
      >
      <n-alert v-if="job?.warnings?.length" type="warning">{{ job.warnings.join(" ") }}</n-alert>
      <n-alert v-if="!ready && initialized" type="warning"
        >需要已安装的 FFmpeg 共享媒体运行时；请在能力管理中检查后重新打开。</n-alert
      >
      <div class="editor-layout">
        <section v-if="!isImage" class="editor-materials">
          <ArchiveMaterialPanel
            v-if="roughCut.loaded.value"
            :item-id="item.id"
            :media-id="mediaId"
            :initial-tab="initialMaterialTab"
            :studio="roughCut.studio.value"
            :clips="roughCut.clips.value"
            :time="roughCut.time.value"
            :disabled="busy || previewIsDraft"
            :playing="roughCut.isPlaying.value"
            :source-name="roughCut.sourceName.value"
            :source-duration="roughCut.sourceDuration.value"
            :source-url="originalUrl"
            :source-urls="roughCut.sourceUrls.value"
            @import="roughCut.registerSource"
            @video="addMaterialVideo"
            @studio="roughCut.updateStudio"
            @texts="roughCut.insertTexts"
            @watermark="addMaterialWatermark"
            @select="(id) => (roughCut.selected.value = [id])"
            @preview="roughCut.stop"
            @reset="workspace.reset"
          />
          <p v-else>正在读取工程…</p>
        </section>
        <div
          v-if="!isImage"
          class="workspace-divider vertical"
          role="separator"
          aria-label="调整素材区宽度"
          aria-orientation="vertical"
          tabindex="0"
          @pointerdown="workspace.resize($event, 'left')"
          @keydown="workspace.nudge($event, 'left')"
        ></div>
        <section ref="fullscreenHost" class="editor-preview">
          <div v-if="!isImage" class="preview-heading">视频预览</div>
          <div ref="previewViewport" class="preview-canvas-bounds">
            <div class="preview-black-frame" :style="!isImage ? previewBackgroundStyle : undefined">
              <ArchiveWatermarkPreview
                :class="{ 'video-stage': !isImage || previewIsDraft }"
                :style="!isImage ? previewCanvasStyle : undefined"
                :video="cutPictureActive ? undefined : video"
                :virtual-video="cutPictureActive ? virtualPreview : undefined"
                :active="false"
                :asset="isImage ? watermarkAsset : undefined"
                :settings="watermarkSettings"
                :disabled="true"
                @pause="roughCut.stop"
                @time="recordPlayhead"
                @duration="recordDuration"
              >
                <video
                  v-if="!isImage || previewIsDraft"
                  v-show="!cutPictureActive"
                  ref="video"
                  :key="previewUrl"
                  :src="previewUrl"
                  :controls="isImage"
                  playsinline
                  preload="auto"
                  @play="
                    musicRange?.stop();
                    nativePlaying = true;
                    roughCut.onPlay();
                  "
                  @timeupdate="
                    roughCut.sync();
                    playbackTime = video?.currentTime ?? 0;
                  "
                  @pause="nativePlaying = false"
                  @ended="roughCut.onEnded()"
                  @loadedmetadata="roughCut.onReady()"
                  @error="previewError"
                />
                <ArchiveCutPicture
                  v-if="cutPictureActive"
                  :video="video"
                  :frame="roughCut.frameSettings.value"
                  :subtitles="roughCut.studio.value.subtitles"
                  :watermarks="roughCut.studio.value.watermarks"
                  :watermark-urls="timelineWatermarkUrls"
                  :active-watermark-id="selectedWatermark?.id"
                  :clips="roughCut.clips.value"
                  :gap="roughCut.isGap.value"
                  :time="roughCut.time.value"
                  :source-width="roughCut.sourceWidth.value"
                  :source-height="roughCut.sourceHeight.value"
                  :source-url="originalUrl"
                  :source-urls="roughCut.sourceUrls.value"
                  :reverse-sources="roughCut.reverseSources.value"
                  :raw-comparison="roughCut.comparisonOriginal.value"
                  :playing="roughCut.isPlaying.value"
                  :active-clip-id="panel === 'cut' ? activeClipId : undefined"
                  :active-subtitle-id="panel === 'cut' ? activeSubtitleId : undefined"
                  :disabled="panel !== 'cut' || busy"
                  @select="onSubtitleSelect"
                  @subtitle="(id, changes) => roughCut.updateSubtitle(id, changes, true)"
                  @clip="(id, changes) => roughCut.updateClip(id, changes, true)"
                  @watermark="(id, changes) => roughCut.updateWatermark(id, changes, true)"
                  @pause="roughCut.stop"
                />
                <img v-if="isImage && !previewIsDraft" class="slideshow-image" :src="previewUrl" alt="图集原图预览" />
              </ArchiveWatermarkPreview>
            </div>
          </div>
          <div v-if="!isImage" class="preview-transport">
            <span class="transport-clock"
              >{{ displayTime(!previewIsDraft ? roughCut.time.value : playbackTime) }} /
              {{ displayTime(editDuration) }}</span
            >
            <n-button
              quaternary
              circle
              size="small"
              :aria-label="previewPlaying ? '暂停' : '播放'"
              :title="previewPlaying ? '暂停（空格）' : '播放（空格）'"
              @click="togglePreview"
              ><component :is="previewPlaying ? Pause : Play" :size="21"
            /></n-button>
            <div class="transport-end">
              <n-dropdown
                trigger="click"
                :to="fullscreenHost"
                :options="previewAspectOptions.map((option) => ({ label: option.label, key: option.value }))"
                :disabled="busy || !roughCut.loaded.value || previewIsDraft || panel !== 'cut'"
                @select="selectPreviewAspect"
                ><button
                  class="aspect-badge"
                  type="button"
                  aria-label="切换成片画幅比例"
                  title="成片画幅比例"
                  :disabled="busy || !roughCut.loaded.value || previewIsDraft || panel !== 'cut'"
                >
                  {{ previewAspectLabel }}
                </button></n-dropdown
              >
              <n-button
                quaternary
                circle
                size="small"
                aria-label="全屏预览"
                title="全屏预览 / Esc 退出"
                @click="toggleFullscreen"
                ><Maximize :size="17"
              /></n-button>
            </div>
          </div>
          <video
            v-if="current?.audioEdit && !isImage"
            :key="`${originalUrl}/${current.checksum}`"
            data-original-duration
            :src="originalUrl"
            preload="metadata"
            hidden
            style="display: none"
            @loadedmetadata="recordOriginalDuration"
          />
          <div v-if="isImage" class="editor-fades">
            <label
              >每张停留（秒）<n-input-number
                :precision="2"
                :value="editorNumber(secondsPerImage, 2)"
                :min="0.5"
                :max="30"
                :disabled="busy"
                @update:value="(value) => value !== null && (secondsPerImage = editorNumber(value, 2))" /></label
            ><label
              >视频画幅<n-select
                v-model:value="aspect"
                :disabled="busy"
                :options="[
                  { label: '竖版 720 × 1280', value: 'portrait' },
                  { label: '竖版 3:4（720 × 960）', value: 'portrait_3_4' },
                  { label: '横版 1280 × 720', value: 'landscape' },
                  { label: '方形 1080 × 1080', value: 'square' }
                ]"
            /></label>
          </div>
          <p v-if="isImage" class="editor-hint">
            按原图顺序生成附加视频，不足 15 秒时循环至完整一轮结束；原图不会被替换。
          </p>
          <p v-if="isImage">{{ previewIsDraft ? "图集效果预览（尚未保存）" : "原图预览" }}</p>
        </section>
        <div
          v-if="!isImage"
          class="workspace-divider vertical"
          role="separator"
          aria-label="调整属性区宽度"
          aria-orientation="vertical"
          tabindex="0"
          @pointerdown="workspace.resize($event, 'right')"
          @keydown="workspace.nudge($event, 'right')"
        ></div>
        <section class="editor-controls">
          <p v-if="panel === 'cut' && !roughCut.selected.value.length" class="inspector-empty">
            选择时间线中的视频、文本、音频或水印，查看对应属性。
          </p>
          <label v-if="!isImage && !roughCut.selected.value.length" class="master-volume"
            >原声总音量<n-slider
              :value="roughCut.studio.value.masterVolume ?? 100"
              :min="0"
              :max="100"
              :step="1"
              :disabled="busy || !roughCut.loaded.value"
              @update:value="roughCut.updateStudio({ ...roughCut.studio.value, masterVolume: $event })"
          /></label>
          <div v-if="panel === 'cut' && roughCut.selected.value.length > 1" class="batch-inspector">
            <strong>已选择 {{ roughCut.selected.value.length }} 个元素</strong>
            <div class="editor-actions">
              <n-button size="small" :disabled="busy || !roughCut.canTrim.value" @click="roughCut.trim('left')"
                >向左裁剪 Q</n-button
              ><n-button size="small" :disabled="busy || !roughCut.canTrim.value" @click="roughCut.trim('right')"
                >向右裁剪 W</n-button
              ><n-button size="small" :disabled="busy || !roughCut.canTrim.value" @click="roughCut.split"
                >按指针拆分</n-button
              ><n-button size="small" :disabled="busy" @click="roughCut.remove">删除所选</n-button>
            </div>
          </div>
          <template v-if="panel === 'cut' && !isImage && ['video', 'music'].includes(inspector)">
            <p v-if="roughCut.loading.value" role="status">正在读取原片和工程草稿…</p>
            <n-alert v-if="roughCut.error.value" type="error"
              >{{ roughCut.error.value
              }}<n-button size="small" @click="roughCut.loaded.value ? roughCut.flush() : roughCut.load()"
                >重试</n-button
              ></n-alert
            >
            <ArchiveCutSettings
              v-if="roughCut.loaded.value"
              :music="selectedMusic"
              :clips="roughCut.clips.value"
              :selected="roughCut.selected.value"
              :frame="roughCut.frameSettings.value"
              :source-duration="
                roughCut.durationFor(roughCut.clips.value.find((clip) => clip.id === roughCut.selected.value[0]))
              "
              :source-width="roughCut.sourceWidth.value"
              :source-height="roughCut.sourceHeight.value"
              :fps="roughCut.fpsFor(roughCut.clips.value.find((clip) => clip.id === roughCut.selected.value[0]))"
              :disabled="busy || previewIsDraft || selectionLocked"
              @clip="roughCut.updateClip"
              @music="roughCut.updateMusic"
              @frame="roughCut.updateFrame"
            />
          </template>
          <ArchiveWatermarkSettings
            v-else-if="!isImage && selectedWatermark && inspector === 'watermark'"
            :key="selectedWatermark.id"
            :mark="selectedWatermark"
            :url="timelineWatermarkUrls[selectedWatermark.asset.id] ?? ''"
            :width="virtualPreview.width"
            :height="virtualPreview.height"
            :time="roughCut.time.value"
            :disabled="busy || previewIsDraft || selectionLocked"
            @update="roughCut.updateWatermark(selectedWatermark.id, $event)"
            @seek="seekCut"
            @remove="roughCut.remove"
          />
          <template v-else-if="panel === 'audio' || isImage">
            <label v-if="!isImage"
              >视频原声音量 {{ settings.originalVolume }}%<n-slider
                v-model:value="settings.originalVolume"
                v-slider-label="{ label: '视频原声音量', text: `${settings.originalVolume}%` }"
                :step="1"
                :format-tooltip="editorTooltip(0)"
                :min="0"
                :max="100"
                :disabled="busy"
                aria-label="视频原声音量"
            /></label>
            <n-button
              v-if="!isImage"
              size="small"
              :disabled="busy"
              @click="settings.originalVolume = settings.originalVolume ? 0 : 100"
              >{{ settings.originalVolume ? "原声静音" : "恢复原声 100%" }}</n-button
            >
            <label
              >背景音乐音量 {{ settings.musicVolume }}%<n-slider
                v-model:value="settings.musicVolume"
                v-slider-label="{ label: '背景音乐音量', text: `${settings.musicVolume}%` }"
                :step="1"
                :format-tooltip="editorTooltip(0)"
                :min="0"
                :max="100"
                :disabled="busy"
                aria-label="背景音乐音量"
            /></label>
            <n-button
              size="small"
              :disabled="busy || !musicId"
              @click="settings.musicVolume = settings.musicVolume ? 0 : 20"
              >{{ settings.musicVolume ? "配乐静音" : "恢复配乐 20%" }}</n-button
            >
            <p v-if="!isImage" class="editor-hint">原声音量调到 0 即静音，原声中的讲话与已有音乐会一起调节。</p>
            <div class="editor-actions">
              <span class="editor-hint">仅查询音频素材库中的「背景音乐」</span>
              <n-button :disabled="busy" @click="fileInput?.click()">上传音乐</n-button>
              <router-link
                v-if="embedded"
                :to="{
                  path: '/tools/audio-convert',
                  query: {
                    archiveId: item.id,
                    mediaId,
                    returnTo: conversionReturnTo
                  }
                }"
                ><n-button :disabled="busy">OGG / MGG / FLAC 转 MP3</n-button></router-link
              >
              <input ref="fileInput" hidden type="file" accept=".mp3,.wav,.m4a,.flac" @change="uploadMusic" />
            </div>
            <div class="editor-actions">
              <n-input
                v-model:value="keyword"
                placeholder="搜索音乐标题、备注"
                :disabled="busy"
                @keyup.enter="searchMusic"
              /><n-button :disabled="busy" @click="searchMusic">搜索</n-button>
            </div>
            <n-select
              :value="musicId"
              :options="musicOptions"
              clearable
              :disabled="busy"
              placeholder="不添加背景音乐"
              aria-label="选择背景音乐"
              @update:value="chooseMusic"
            />
            <n-pagination
              v-if="musicTotal > 20"
              v-model:page="musicPage"
              class="pagination-with-total"
              :page-size="20"
              :item-count="musicTotal"
              :disabled="busy"
              @update:page="loadMusic"
              ><template #prefix>共 {{ musicTotal }} 条</template></n-pagination
            >
            <ArchiveMusicRange
              v-if="musicUrl"
              ref="musicRange"
              :key="musicUrl"
              v-model:start="settings.musicStartSeconds"
              :url="musicUrl"
              :title="
                musicId === '__original__'
                  ? originalMusic?.title || '原作品配乐'
                  : (chosenMusic?.title ?? current?.audioEdit?.music?.title ?? '当前配乐')
              "
              :music-duration="musicId === '__original__' ? undefined : chosenMusic?.duration"
              :video-duration="editDuration"
              :disabled="busy"
              :loop="settings.loop"
              :volume="settings.musicVolume"
              @play="video?.pause()"
            />
            <n-checkbox v-model:checked="settings.loop" :disabled="busy || !musicId"
              >音乐不足时循环；超出视频部分自动截断</n-checkbox
            >
            <div class="editor-fades">
              <label
                >淡入（秒）<n-input-number
                  :precision="2"
                  :value="editorNumber(settings.fadeInSeconds, 2)"
                  :min="0"
                  :max="5"
                  :disabled="busy || !musicId"
                  @update:value="
                    (value) => value !== null && (settings.fadeInSeconds = editorNumber(value, 2))
                  " /></label
              ><label
                >淡出（秒）<n-input-number
                  :precision="2"
                  :value="editorNumber(settings.fadeOutSeconds, 2)"
                  :min="0"
                  :max="5"
                  :disabled="busy || !musicId"
                  @update:value="(value) => value !== null && (settings.fadeOutSeconds = editorNumber(value, 2))"
              /></label>
            </div>
            <p v-if="uploading" role="status">正在上传音乐…</p>
          </template>
          <p v-if="watermarkUploading" role="status">正在上传水印…</p>
          <ArchiveTextSettings
            v-if="
              !isImage &&
              panel === 'cut' &&
              inspector === 'subtitles' &&
              roughCut.selected.value.length === 1 &&
              roughCut.loaded.value &&
              selectedText
            "
            :cue="selectedText"
            :width="virtualPreview.width"
            :height="virtualPreview.height"
            :disabled="busy || previewIsDraft || selectionLocked"
            @update="roughCut.updateSubtitle"
          />
        </section>
      </div>
      <div
        v-if="!isImage"
        class="workspace-divider horizontal"
        role="separator"
        aria-label="调整时间线高度"
        aria-orientation="horizontal"
        tabindex="0"
        @pointerdown="workspace.resize($event, 'top')"
        @keydown="workspace.nudge($event, 'top')"
      ></div>
      <ArchiveCutTimeline
        v-if="!isImage && roughCut.loaded.value"
        v-model:selected="roughCut.selected.value"
        v-model:zoom="roughCut.zoom.value"
        v-model:snapping="roughCut.snapping.value"
        :clips="roughCut.clips.value"
        :time="roughCut.time.value"
        :duration="roughCut.duration.value"
        :item-id="item.id"
        :media-id="mediaId"
        :source-name="roughCut.sourceName.value"
        :source-has-audio="roughCut.sourceHasAudio.value"
        :source-revision="current?.audioEdit?.original.checksum ?? current?.checksum ?? ''"
        :source-duration="roughCut.sourceDuration.value"
        :fps="roughCut.fps.value"
        :can-trim="roughCut.canTrim.value"
        :can-undo="Boolean(roughCut.undo.value.length)"
        :can-redo="Boolean(roughCut.redo.value.length)"
        :can-video-tools="roughCut.canVideoTools.value"
        :can-reverse="roughCut.canReverse.value"
        :can-freeze="roughCut.canFreeze.value"
        :can-paste="roughCut.canPaste.value"
        :output-fps="roughCut.frameSettings.value.fps"
        :freeze-sources="roughCut.freezeSources.value"
        :source-url="originalUrl"
        :source-urls="roughCut.sourceUrls.value"
        :sources="roughCut.studio.value.sources"
        :music-urls="timelineMusicUrls"
        :watermark-urls="timelineWatermarkUrls"
        :studio="roughCut.studio.value"
        :disabled="busy || previewIsDraft || panel !== 'cut'"
        @minimum-height="minimumTimelineHeight = $event"
        @audio-begin="roughCut.beginAudio"
        @audio="roughCut.previewAudio"
        @audio-end="roughCut.finishAudio"
        @studio="roughCut.updateStudio"
        @track="roughCut.toggleTrack"
        @seek="seekCut"
        @play="togglePreview"
        @split="roughCut.split"
        @trim="roughCut.trim"
        @remove="roughCut.remove"
        @undo="roughCut.undoEdit"
        @redo="roughCut.redoEdit"
        @rotate="roughCut.rotateVideo"
        @mirror="roughCut.mirrorVideo"
        @reverse="roughCut.reverseVideo"
        @freeze="roughCut.freezeVideo"
        @copy="roughCut.copySelection"
        @paste="roughCut.pasteSelection"
        @begin="roughCut.begin"
        @commit="roughCut.commit"
        @layout="roughCut.commitLayout"
        @cancel="roughCut.cancelGesture"
      />
      <ArchiveOutputSettings
        :show="outputDialogShown"
        :exporting="outputRequest?.exporting"
        :initial="outputDialogInitial"
        :runtime="roughCut.interpolationRuntime.value"
        :checking="roughCut.checkingInterpolation.value"
        :legacy="roughCut.legacyInterpolation.value"
        :busy="submitting || activeJob"
        @start="startOutput"
        @cancel="cancelOutput"
        @refresh="roughCut.refreshInterpolationRuntime"
      />
      <n-modal
        :show="operationLoading"
        preset="card"
        :title="operationTitle"
        :closable="false"
        :mask-closable="false"
        :close-on-esc="false"
        style="width: min(460px, calc(100vw - 32px))"
      >
        <n-progress
          v-if="activeJob || syncingResult || roughCut.reversePreparing.value"
          type="line"
          :percentage="
            Math.floor(
              roughCut.reversePreparing.value
                ? roughCut.reverseProgress.value
                : syncingResult
                  ? 100
                  : (job?.progress ?? 0)
            )
          "
          :processing="true"
        />
        <n-spin v-else size="medium" />
        <p role="status" class="operation-message">
          {{
            roughCut.reversePreparing.value
              ? roughCut.processingMessage.value || "正在准备视频预览，请稍候…"
              : syncingResult
                ? "正在同步保存结果…"
                : activeJob
                  ? job?.message
                  : watermarkUploading || uploading
                    ? "正在上传，请稍候…"
                    : "正在提交任务，请稍候…"
          }}
        </p>
        <n-alert v-if="error && activeJob" type="error"
          >{{ error }}<n-button size="small" @click="schedulePoll(generation)">重试状态</n-button></n-alert
        >
        <template #footer
          ><div class="editor-actions editor-footer">
            <n-button v-if="activeJob" :disabled="job?.stage === 'saving'" @click="cancel">停止任务</n-button>
            <n-button v-if="roughCut.reversePreparing.value" @click="roughCut.cancelReverse">取消处理</n-button>
          </div></template
        >
      </n-modal>
      <template #footer
        ><div class="editor-actions editor-footer">
          <n-button :disabled="busy || !current" @click="restore">恢复原始视频</n-button>
          <n-button
            v-if="!isImage"
            :disabled="
              busy ||
              !ready ||
              !initialized ||
              Boolean(watermarkValidation) ||
              (panel === 'cut' && !roughCut.loaded.value) ||
              (roughCut.loaded.value && !roughCut.clips.value.length)
            "
            @click="requestOutput('preview', true)"
            >导出视频</n-button
          >
          <n-button v-if="exportedUrl" tag="a" :href="exportedUrl">下载生成的视频</n-button>
          <n-button @click="close">关闭窗口</n-button>
          <n-button
            type="primary"
            :loading="submitting"
            :disabled="
              busy ||
              !ready ||
              !initialized ||
              Boolean(watermarkValidation) ||
              (panel === 'cut' && !roughCut.loaded.value) ||
              (roughCut.loaded.value && !roughCut.clips.value.length)
            "
            @click="isImage ? submit('save') : requestOutput('save')"
            >{{ isImage ? "生成视频并归档" : saveLabel || "保存为最新版本" }}</n-button
          >
        </div>
        <small
          >长期保留原片、最新成品及当前配乐和水印；旧成品在成功保存且播放或下载结束后清理，不保留无限版本。添加水印需要重新编码，耗时及文件大小可能增加。</small
        ></template
      >
    </n-card>
  </component>
</template>

<script setup lang="ts">
import { editorNumber, editorTooltip } from "./editor-numbers";
import { Play, Pause, Maximize } from "lucide-vue-next";
import { useArchiveEditorLayout } from "./useArchiveEditorLayout";
import { vSliderLabel } from "../../shared/ui/slider-label";
import { computed, onScopeDispose, reactive, ref, watch, toRaw, nextTick } from "vue";
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NProgress,
  NSpin,
  NSelect,
  NDropdown,
  NSlider
} from "naive-ui";
import {
  defaultArchiveAudioSettings,
  archiveSlideshowDuration,
  archiveProjectDuration,
  archiveFrameGeometry,
  type ArchiveFrame,
  defaultArchiveWatermarkSettings,
  type ArchiveWatermarkDraft,
  type ArchiveStudioMusic,
  type ArchiveStudioSource,
  watermarkTimingError,
  type ArchiveSlideshowAspect,
  type ArchiveVideoEdit,
  type ArchiveVideoEditInput,
  type ArchiveVideoEditJob,
  type AudioLibraryItemView,
  type ContentArchiveItem,
  type ContentArchiveMedia
} from "@toolbox/shared";
import type { ArchiveVideoOutput } from "@toolbox/shared";
import ArchiveOutputSettings from "./ArchiveOutputSettings.vue";
import { videoEditApi } from "./video-edit-api";
import { contentArchiveApi } from "./content-api";
import { archiveMusicLibraryApi as audioLibraryApi } from "../audio-library/integrations/music";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import ArchiveWatermarkPreview from "./ArchiveWatermarkPreview.vue";
import ArchiveMusicRange from "./ArchiveMusicRange.vue";
import ArchiveCutTimeline from "./ArchiveCutTimeline.vue";
import ArchiveMaterialPanel from "./ArchiveMaterialPanel.vue";
import ArchiveWatermarkSettings from "./ArchiveWatermarkSettings.vue";

import ArchiveTextSettings from "./ArchiveTextSettings.vue";
import { prepareSubtitleExport } from "./subtitle-export";
import ArchiveCutSettings from "./ArchiveCutSettings.vue";
import ArchiveCutPicture from "./ArchiveCutPicture.vue";
import { cutClipId, useArchiveRoughCut } from "./useArchiveRoughCut";
import { useArchiveWatermark } from "./useArchiveWatermark";
const props = defineProps<{
  show: boolean;
  item: ContentArchiveItem;
  mediaId: string;
  embedded?: boolean;
  initialPanel?: "audio" | "watermark" | "cut";
  initialMusicId?: string;
  conversionReturnTo?: string;
  saveLabel?: string;
  draftAssets?: Pick<ArchiveVideoEdit, "studioSources" | "studioMusic">;
}>();
const emit = defineEmits<{ "update:show": [value: boolean]; saved: [item: ContentArchiveItem] }>();
const confirm = useConfirmDialog();
const current = ref<ContentArchiveMedia>();
const initialMaterialTab = computed(() =>
  props.initialPanel === "watermark" ? "watermark" : props.initialPanel === "audio" ? "audio" : "sources"
);
const panel = computed(() => (current.value?.kind === "image" ? "audio" : "cut")),
  videoDuration = ref(0),
  originalDuration = ref(0);
const {
  settings: watermarkSettings,
  asset: watermarkAsset,
  input: watermarkInput,
  uploading: watermarkUploading,
  error: watermarkError,
  load: loadWatermark
} = useArchiveWatermark(
  () => props.item.id,
  current,
  () => scope.signal
);
const watermarkValidation = computed(() =>
  isImage.value && watermarkInput.value ? watermarkTimingError(watermarkSettings.value, editDuration.value) : undefined
);
const isImage = computed(() => current.value?.kind === "image");
const secondsPerImage = ref(3),
  aspect = ref<ArchiveSlideshowAspect>("portrait");
const editDuration = computed(() =>
  isImage.value
    ? archiveSlideshowDuration(
        props.item.media.filter((entry) => entry.kind === "image" && !entry.frameSourceMediaId).length,
        secondsPerImage.value
      )
    : roughCut.loaded.value
      ? roughCut.duration.value
      : ((current.value?.audioEdit?.cut
          ? archiveProjectDuration(current.value.audioEdit.cut, current.value.audioEdit.studio)
          : undefined) ?? videoDuration.value)
);
const settings = reactive(defaultArchiveAudioSettings());
const originalMusic = computed(() => props.item.media.find((media) => media.kind === "audio"));
const musicId = ref<string | null>(null),
  chosenMusic = ref<AudioLibraryItemView>(),
  music = ref<AudioLibraryItemView[]>([]);
const musicPage = ref(1),
  musicTotal = ref(0),
  keyword = ref("");
const job = ref<ArchiveVideoEditJob>(),
  error = ref(""),
  ready = ref(false),
  initialized = ref(false),
  submitting = ref(false),
  syncingResult = ref(false),
  uploading = ref(false);
const previewUrl = ref(""),
  previewIsDraft = ref(false),
  video = ref<HTMLVideoElement>(),
  fileInput = ref<HTMLInputElement>();
const roughCut = useArchiveRoughCut(
  () => props.item.id,
  () => current.value,
  () => video.value,
  () => !isImage.value && !previewIsDraft.value,
  () => originalUrl.value,
  () => settings.originalVolume,
  (source) =>
    resolveBackendUrl(
      [...(current.value?.audioEdit?.studioSources ?? []), ...(props.draftAssets?.studioSources ?? [])].some(
        (entry) => entry.sourceId === source.id && entry.ref.checksum === source.checksum
      )
        ? `/api/v1/tools/media-archive/items/${props.item.id}/media/${props.mediaId}/studio-sources/${source.id}`
        : `/api/v1/tools/media-archive/items/${source.itemId}/media/${source.mediaId}/original`
    ),
  (url) => {
    if (!previewIsDraft.value) previewUrl.value = url;
  },
  studioMusicUrl,
  () =>
    isImage.value && musicUrl.value
      ? {
          url: musicUrl.value,
          start: settings.musicStartSeconds,
          volume: settings.musicVolume,
          loop: settings.loop,
          fadeIn: settings.fadeInSeconds,
          fadeOut: settings.fadeOutSeconds
        }
      : undefined,
  () => panel.value === "cut",
  () => !busy.value
);
function studioMusicUrl(track: ArchiveStudioMusic) {
  const snapshot = [...(current.value?.audioEdit?.studioMusic ?? []), ...(props.draftAssets?.studioMusic ?? [])].find(
    (entry) =>
      entry.trackId === track.snapshotId ||
      (entry.libraryItemId === track.libraryItemId && entry.libraryRevision === track.libraryRevision)
  );
  if (!snapshot && track.snapshotId === "legacy_music" && current.value?.audioEdit?.music)
    return resolveBackendUrl(`/api/v1/tools/media-archive/items/${props.item.id}/media/${props.mediaId}/saved-music`);
  const localTrackId =
    snapshot?.trackId ?? (track.libraryItemId.startsWith("local_audio_") ? track.libraryItemId : undefined);
  return resolveBackendUrl(
    localTrackId
      ? `/api/v1/tools/media-archive/items/${props.item.id}/media/${props.mediaId}/studio-music/${localTrackId}`
      : `/api/v1/tools/audio-library/items/${track.libraryItemId}/audio`
  );
}
const timelineMusicUrls = computed(() =>
  Object.fromEntries(roughCut.studio.value.musicTracks.map((track) => [track.id, studioMusicUrl(track)]))
);
const timelineWatermarkUrls = computed(() =>
  Object.fromEntries(
    (roughCut.studio.value.watermarks ?? []).map((mark) => [
      mark.asset.id,
      resolveBackendUrl(
        `/api/v1/tools/media-archive/items/${props.item.id}/media/${props.mediaId}/${mark.asset.kind === "draft" ? "watermarks" : "studio-watermarks"}/${mark.asset.id}?v=${mark.asset.checksum ?? ""}`
      )
    ])
  )
);
function addMaterialWatermark(asset: ArchiveWatermarkDraft, title: string) {
  const settings = defaultArchiveWatermarkSettings();
  settings.motion.type = "fixed";
  settings.motion.from = settings.motion.to = { x: 0.5, y: 0.5 };
  const start = Math.min(roughCut.time.value, Math.max(0, roughCut.duration.value - 0.01));
  roughCut.addWatermark({
    id: cutClipId(),
    title,
    start,
    end: roughCut.duration.value,
    sourceStart: 0,
    followEnd: true,
    settings,
    asset: { id: asset.id, kind: "draft", width: asset.width, height: asset.height }
  });
}
watch(
  () => roughCut.studio.value.masterVolume,
  (value) => {
    if (value !== undefined) settings.originalVolume = value;
  },
  { flush: "sync" }
);
const cutPictureActive = computed(() => !isImage.value && !previewIsDraft.value && roughCut.loaded.value);
const virtualPreview = computed(() => ({
  ...archiveFrameGeometry(
    roughCut.sourceWidth.value || 2,
    roughCut.sourceHeight.value || 2,
    roughCut.frameSettings.value
  ),
  duration: roughCut.duration.value,
  currentTime: roughCut.time.value,
  paused: !roughCut.isPlaying.value
}));
// 黑色画布以成片画幅为坐标系，面板只决定显示倍率，不改变画布比例。
const previewViewport = ref<HTMLElement>();
const previewBounds = reactive({ width: 0, height: 0 });
const previewFullscreen = ref(false);
watch(
  previewViewport,
  (element, _previous, cleanup) => {
    if (!element) return;
    const measure = () => {
      previewBounds.width = element.clientWidth;
      previewBounds.height = element.clientHeight;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    cleanup(() => observer.disconnect());
  },
  { flush: "post" }
);
const previewBackgroundSize = computed(() => {
  const ratio = virtualPreview.value.width / virtualPreview.value.height;
  if (previewFullscreen.value) {
    // Fullscreen uses the entire viewport left above the transport controls,
    // including upscaling small sources, while retaining the export aspect ratio.
    const width = Math.min(Math.max(1, previewBounds.width), Math.max(1, previewBounds.height) * ratio);
    return { width, height: width / ratio };
  }
  const width = Math.min(
    960,
    720 * ratio,
    Math.max(1, previewBounds.width - 24),
    Math.max(1, previewBounds.height - 56) * ratio
  );
  return { width, height: width / ratio };
});
const previewAspectLabel = computed(() => {
  const aspect = roughCut.frameSettings.value.aspect;
  if (aspect !== "source") return aspect;
  const { width, height } = virtualPreview.value;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const unit = gcd(width, height) || 1;
  return `${width / unit}:${height / unit}`;
});
const previewBackgroundStyle = computed(() => ({
  width: `${previewBackgroundSize.value.width}px`,
  height: `${previewBackgroundSize.value.height}px`,
  aspectRatio: `${virtualPreview.value.width}/${virtualPreview.value.height}`
}));
const previewCanvasStyle = computed(() => {
  const { width, height } = virtualPreview.value,
    bounds = previewBackgroundSize.value;
  const scale = Math.min(previewFullscreen.value ? Infinity : 1, bounds.width / width, bounds.height / height);
  return {
    width: `${width * scale}px`,
    height: `${height * scale}px`,
    flex: "none",
    aspectRatio: `${width}/${height}`
  };
});
const activeClipId = computed(() =>
  roughCut.selected.value.length === 1 && roughCut.clips.value.some((clip) => clip.id === roughCut.selected.value[0])
    ? roughCut.selected.value[0]
    : undefined
);
const activeSubtitleId = computed(() => {
  const selected = roughCut.selected.value;
  if (selected.length !== 1) return undefined;
  const id = selected[0];
  return roughCut.studio.value.subtitles.some((cue) => cue.id === id) ? id : undefined;
});
function onSubtitleSelect(id: string) {
  roughCut.selected.value = id ? [id] : [];
}
const minimumTimelineHeight = ref(200);
const workspace = useArchiveEditorLayout(() => minimumTimelineHeight.value);
function addMaterialVideo(source?: ArchiveStudioSource) {
  if (source) roughCut.appendSource(source);
  else roughCut.appendOriginal();
}
const fullscreenHost = ref<HTMLElement>();
function syncPreviewFullscreen() {
  previewFullscreen.value = document.fullscreenElement === fullscreenHost.value;
}
document.addEventListener("fullscreenchange", syncPreviewFullscreen);
const playbackTime = ref(0),
  nativePlaying = ref(false);
const previewPlaying = computed(() =>
  !isImage.value && !previewIsDraft.value ? roughCut.isPlaying.value : nativePlaying.value
);
const displayTime = (value: number) => `${Math.floor(value / 60)}:${(value % 60).toFixed(2).padStart(5, "0")}`;
function togglePreview() {
  if (!isImage.value && !previewIsDraft.value) roughCut.togglePlay();
  else if (video.value?.paused) void video.value.play().catch((e) => (error.value = formatApiError(e)));
  else video.value?.pause();
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await fullscreenHost.value?.requestFullscreen();
  } catch {
    error.value = "当前环境无法进入全屏预览";
  }
}
const selectionLocked = computed(() =>
  [
    ...roughCut.clips.value,
    ...roughCut.studio.value.subtitles,
    ...roughCut.studio.value.musicTracks,
    ...(roughCut.studio.value.watermarks ?? [])
  ].some((entry) => entry.locked && roughCut.selected.value.includes(entry.id))
);
const inspector = computed(() => {
  if (roughCut.selected.value.length !== 1)
    return roughCut.clips.value.some((clip) => roughCut.selected.value.includes(clip.id)) ? "video" : "";
  const id = roughCut.selected.value[0];
  if (roughCut.clips.value.some((entry) => entry.id === id)) return "video";
  if (roughCut.studio.value.subtitles.some((entry) => entry.id === id)) return "subtitles";
  if (roughCut.studio.value.musicTracks.some((entry) => entry.id === id)) return "music";
  if (roughCut.studio.value.watermarks?.some((entry) => entry.id === id)) return "watermark";
  return "";
});
const selectedWatermark = computed(() =>
  roughCut.selected.value.length === 1
    ? roughCut.studio.value.watermarks?.find((mark) => mark.id === roughCut.selected.value[0])
    : undefined
);
const selectedMusic = computed(() =>
  roughCut.selected.value.length === 1
    ? roughCut.studio.value.musicTracks.find((track) => track.id === roughCut.selected.value[0])
    : undefined
);
const selectedText = computed(() => roughCut.studio.value.subtitles.find((cue) => cue.id === activeSubtitleId.value));
function previewHotkey(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (event.target as HTMLElement)?.closest("input,textarea,select,[contenteditable=true],.n-base-selection,.n-slider")
  )
    return;
  if (event.code === "Space" && (previewIsDraft.value || panel.value !== "cut")) {
    event.preventDefault();
    togglePreview();
  }
}
window.addEventListener("keydown", previewHotkey);
onScopeDispose(() => {
  window.removeEventListener("keydown", previewHotkey);
  document.removeEventListener("fullscreenchange", syncPreviewFullscreen);
  if (document.fullscreenElement === fullscreenHost.value) void document.exitFullscreen().catch(() => {});
});
const previewAspectOptions = [
  { label: "原始比例", value: "source" },
  { label: "横屏 16:9", value: "16:9" },
  { label: "竖屏 9:16", value: "9:16" },
  { label: "竖屏 3:4", value: "3:4" },
  { label: "方形 1:1", value: "1:1" }
];
function selectPreviewAspect(key: string | number) {
  if (previewAspectOptions.some((option) => option.value === key)) changePreviewAspect(key as ArchiveFrame["aspect"]);
}
function changePreviewAspect(value: ArchiveFrame["aspect"]) {
  if (busy.value || !roughCut.loaded.value) return;
  roughCut.updateFrame({ ...roughCut.frameSettings.value, aspect: value, fit: "contain" });
}
const musicRange = ref<InstanceType<typeof ArchiveMusicRange>>();
const activeJob = computed(() => Boolean(job.value && ["pending", "running"].includes(job.value.status)));
const operationLoading = computed(
  () =>
    submitting.value ||
    activeJob.value ||
    syncingResult.value ||
    uploading.value ||
    watermarkUploading.value ||
    roughCut.reversePreparing.value
);
const operationTitle = computed(() =>
  roughCut.reversePreparing.value
    ? "正在准备视频效果"
    : watermarkUploading.value || uploading.value
      ? "正在上传"
      : syncingResult.value
        ? "正在同步结果"
        : job.value?.mode === "restore"
          ? "正在恢复"
          : job.value?.mode === "preview"
            ? "正在导出视频"
            : "正在保存"
);
const exportedUrl = ref(""),
  exportJobId = ref<string>();
const outputDialogShown = ref(false),
  outputDialogInitial = ref<ArchiveVideoOutput>({}),
  outputDraft = ref<ArchiveVideoOutput>();
const outputRequest = ref<{ mode: "save" | "preview"; exporting: boolean }>();
let resolveOutput: ((id: string | undefined) => void) | undefined;
function cancelOutput() {
  outputDialogShown.value = false;
  outputRequest.value = undefined;
  resolveOutput?.(undefined);
  resolveOutput = undefined;
}
function requestOutput(mode: "save" | "preview", exporting = false): Promise<string | undefined> {
  if (busy.value || resolveOutput) return Promise.resolve(undefined);
  roughCut.stop();
  video.value?.pause();
  outputDialogInitial.value = structuredClone(
    toRaw(outputDraft.value ?? current.value?.audioEdit?.outputSettings ?? {})
  );
  outputRequest.value = { mode, exporting };
  outputDialogShown.value = true;
  return new Promise((resolve) => {
    resolveOutput = resolve;
  });
}
async function startOutput(settings: ArchiveVideoOutput) {
  const request = outputRequest.value,
    resolve = resolveOutput;
  if (!request || !resolve) return;
  outputDraft.value = settings;
  outputDialogShown.value = false;
  outputRequest.value = undefined;
  resolveOutput = undefined;
  try {
    resolve(await submit(request.mode, request.exporting, settings));
  } catch {
    resolve(undefined);
  }
}
const initialRecipe = ref("");
const recipe = computed(() =>
  JSON.stringify([
    settings,
    musicId.value,
    isImage.value ? [secondsPerImage.value, aspect.value] : null,
    watermarkInput.value,
    !isImage.value && roughCut.loaded.value
      ? [roughCut.clips.value, roughCut.frameSettings.value, roughCut.studio.value]
      : null
  ])
);
const busy = computed(
  () =>
    outputDialogShown.value ||
    submitting.value ||
    syncingResult.value ||
    uploading.value ||
    watermarkUploading.value ||
    activeJob.value ||
    roughCut.reversePreparing.value ||
    !initialized.value
);
const originalUrl = computed(() =>
  resolveBackendUrl(
    `/api/v1/tools/media-archive/items/${props.item.id}/media/${current.value?.id ?? props.mediaId}/original`
  )
);
const savedUrl = computed(() => (current.value ? resolveBackendUrl(current.value.previewUrl) : ""));
const musicOptions = computed(() => {
  const items = [...music.value];
  if (chosenMusic.value && !items.some((item) => item.id === chosenMusic.value!.id)) items.unshift(chosenMusic.value);
  return [
    ...(originalMusic.value
      ? [{ label: `${originalMusic.value.title || "原作品配乐"}（随作品归档）`, value: "__original__" }]
      : []),
    ...(current.value?.audioEdit?.music
      ? [{ label: `${current.value.audioEdit.music.title}（当前配乐快照）`, value: "__saved__" }]
      : []),
    ...items
      .filter((item) => item.available)
      .map((item) => ({ label: `${item.title} · ${Math.round(item.duration)} 秒`, value: item.id }))
  ];
});
const musicUrl = computed(() =>
  musicId.value === "__saved__"
    ? resolveBackendUrl(
        `/api/v1/tools/media-archive/items/${props.item.id}/media/${current.value?.id ?? props.mediaId}/saved-music?v=${current.value?.audioEdit?.music?.checksum ?? ""}`
      )
    : musicId.value === "__original__" && originalMusic.value
      ? resolveBackendUrl(originalMusic.value.previewUrl)
      : chosenMusic.value
        ? resolveBackendUrl(chosenMusic.value.audioUrl)
        : ""
);
let scope = new AbortController(),
  timer: ReturnType<typeof setTimeout> | undefined,
  generation = 0,
  musicRequest = 0;
function dispose() {
  cancelOutput();
  scope.abort();
  if (timer) clearTimeout(timer);
  video.value?.pause();
  musicRange.value?.stop();
}
onScopeDispose(dispose);
function beforeUnload(event: BeforeUnloadEvent) {
  if (props.show && initialized.value && !activeJob.value && recipe.value !== initialRecipe.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
window.addEventListener("beforeunload", beforeUnload);
onScopeDispose(() => window.removeEventListener("beforeunload", beforeUnload));
watch(
  // 同一作品的保存结果会由父页面回写，不能因此中断刚创建的编辑画面任务。
  [() => props.show, () => props.item.id, () => props.mediaId],
  async ([show]) => {
    dispose();
    outputDraft.value = undefined;
    scope = new AbortController();
    const version = ++generation;
    if (!show) return;
    error.value = "";
    job.value = undefined;
    submitting.value = false;
    syncingResult.value = false;
    uploading.value = false;
    initialized.value = false;
    ready.value = false;
    applyMedia(props.item.media.find((entry) => entry.id === props.mediaId));
    try {
      const [runtime, jobs] = await Promise.all([
        videoEditApi.runtime(scope.signal),
        videoEditApi.list(props.item.id, props.mediaId, scope.signal),
        loadMusic()
      ]);
      if (version !== generation || scope.signal.aborted) return;
      ready.value = runtime.ready;
      job.value = jobs.find((entry) => !entry.purpose && ["pending", "running"].includes(entry.status));
      if (job.value) schedulePoll(version);
      if (props.initialMusicId && /^[A-Za-z0-9_-]{1,80}$/.test(props.initialMusicId)) {
        const selected = await audioLibraryApi.item(props.initialMusicId);
        if (version !== generation || scope.signal.aborted) return;
        if (!selected.deletedAt && selected.available) {
          chosenMusic.value = selected;
          musicId.value = selected.id;
          settings.musicStartSeconds = 0;
          if (!isImage.value) {
            await roughCut.load();
            if (version !== generation || scope.signal.aborted || !roughCut.loaded.value) return;
            const studio = JSON.parse(JSON.stringify(roughCut.studio.value));
            const start = roughCut.time.value,
              id = cutClipId();
            studio.musicTracks.push({
              id,
              libraryItemId: selected.id,
              libraryRevision: selected.revision,
              title: selected.title,
              start,
              end: start + Math.min(selected.duration, Math.max(0.1, roughCut.duration.value - start)),
              sourceStart: 0,
              volume: 100,
              loop: false,
              fadeIn: 0,
              fadeOut: 0,
              lane:
                Math.max(
                  -1,
                  ...roughCut.clips.value.map((clip) => clip.lane ?? 1),
                  ...studio.subtitles.map((cue: { lane?: number }) => cue.lane ?? 0),
                  ...studio.musicTracks.map((track: { lane?: number }) => track.lane ?? 2),
                  ...(studio.watermarks ?? []).map((mark: { lane?: number }) => mark.lane ?? 0)
                ) + 1
            });
            roughCut.updateStudio(studio);
            roughCut.selected.value = [id];
          }
        }
      }
    } catch (e) {
      if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
    } finally {
      if (version === generation) initialized.value = true;
    }
  },
  { immediate: true }
);
function applyMedia(media?: ContentArchiveMedia) {
  roughCut.reset();
  exportedUrl.value = "";
  exportJobId.value = undefined;
  current.value = media ? structuredClone(toRaw(media)) : undefined;
  loadWatermark(current.value);
  videoDuration.value = (media?.durationMs ?? 0) / 1000;
  originalDuration.value = 0;
  Object.assign(settings, media?.audioEdit?.settings ?? defaultArchiveAudioSettings());
  musicId.value = media?.audioEdit?.music
    ? "__saved__"
    : media?.kind === "image" && originalMusic.value
      ? "__original__"
      : null;
  chosenMusic.value = undefined;
  previewUrl.value = savedUrl.value;
  previewIsDraft.value = false;
  initialRecipe.value = recipe.value;
  const version = generation,
    selectedMedia = current.value;
  if (media && media.kind !== "image")
    void roughCut.load().then(() => {
      if (version !== generation || current.value !== selectedMedia) return;
      if (!isImage.value) viewCut();
      initialRecipe.value = recipe.value;
    });
}
async function loadMusic() {
  const request = ++musicRequest,
    version = generation;
  try {
    const result = await audioLibraryApi.list(
      { view: "music", keyword: keyword.value, page: musicPage.value },
      scope.signal
    );
    if (request !== musicRequest || version !== generation || scope.signal.aborted) return;
    music.value = result.items;
    musicTotal.value = result.total;
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  }
}
function searchMusic() {
  musicPage.value = 1;
  void loadMusic();
}
function chooseMusic(id: string | null) {
  musicId.value = id;
  chosenMusic.value = music.value.find((entry) => entry.id === id);
  settings.musicStartSeconds = id === "__saved__" ? (current.value?.audioEdit?.settings.musicStartSeconds ?? 0) : 0;
}
async function uploadMusic(event: Event) {
  const element = event.target as HTMLInputElement,
    file = element.files?.[0];
  element.value = "";
  if (!file || busy.value) return;
  if (file.size > 100 * 1024 * 1024) {
    error.value = "音乐文件最大 100 MiB";
    return;
  }
  const version = generation;
  uploading.value = true;
  try {
    const result = await audioLibraryApi.upload(file, { purpose: "music" }, undefined, scope.signal);
    if (version !== generation || scope.signal.aborted) return;
    chosenMusic.value = result.item;
    musicId.value = result.item.id;
    settings.musicStartSeconds = 0;
    await loadMusic();
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (version === generation) uploading.value = false;
  }
}
function recordDuration(value: number) {
  if (!previewIsDraft.value && Number.isFinite(value) && value > 0)
    videoDuration.value = originalDuration.value || value;
}
function recordOriginalDuration(event: Event) {
  const element = event.currentTarget as HTMLVideoElement;
  if (element.getAttribute("src") !== originalUrl.value || !Number.isFinite(element.duration) || element.duration <= 0)
    return;
  originalDuration.value = element.duration;
  videoDuration.value = element.duration;
}
function previewError() {
  if (panel.value === "cut" && !previewIsDraft.value) {
    roughCut.error.value = "当前视频素材加载失败，请检查来源视频是否仍可访问，或重新选择素材。";
  }
}
function recordPlayhead(time: number) {
  if (previewIsDraft.value && !isImage.value) playbackTime.value = time;
}
function seekCut(time: number) {
  if (previewIsDraft.value) viewCut();
  roughCut.stop();
  roughCut.seek(time);
}
function viewCut() {
  video.value?.pause();
  previewUrl.value = originalUrl.value;
  previewIsDraft.value = false;
  void roughCut.load().then(async () => {
    await nextTick();
    if (!previewIsDraft.value) roughCut.seek(roughCut.time.value);
  });
}
watch(panel, () => {
  if (!isImage.value && !previewIsDraft.value) viewCut();
});
watch(
  [roughCut.clips, roughCut.frameSettings, roughCut.studio],
  () => {
    exportedUrl.value = "";
  },
  { deep: true }
);
watch(recipe, () => {
  exportedUrl.value = "";
});
async function submit(mode: ArchiveVideoEditInput["mode"], exporting = false, outputSettings?: ArchiveVideoOutput) {
  if (!current.value || busy.value || scope.signal.aborted) return;
  if (mode !== "restore" && panel.value === "cut" && !roughCut.loaded.value) {
    error.value = "请先等待原片和工程草稿读取完成";
    return;
  }
  if (mode !== "restore" && isImage.value && watermarkValidation.value) {
    error.value = watermarkValidation.value;
    return;
  }
  if (mode !== "restore" && roughCut.loaded.value && !roughCut.clips.value.length) {
    error.value = "请至少保留一个视频片段";
    return;
  }
  const version = generation;
  submitting.value = true;
  await roughCut.flush();
  if (scope.signal.aborted || version !== generation) {
    submitting.value = false;
    return;
  }
  video.value?.pause();
  error.value = "";
  musicRange.value?.stop();
  const images = props.item.media.filter((entry) => entry.kind === "image" && !entry.frameSourceMediaId);
  if (isImage.value && images.length > 100) {
    error.value = "图集生成视频每次最多支持 100 张原图";
    submitting.value = false;
    return;
  }
  const input: ArchiveVideoEditInput = {
    ...(outputSettings ? { outputSettings } : {}),
    mode,
    revision: current.value.audioEdit?.revision ?? 0,
    checksum: current.value.checksum,
    useSavedMusic: musicId.value === "__saved__",
    ...(musicId.value === "__original__" && originalMusic.value
      ? { sourceMusicId: originalMusic.value.id, sourceMusicChecksum: originalMusic.value.checksum }
      : {}),
    settings: { ...settings },
    ...(roughCut.loaded.value && mode !== "restore"
      ? {
          cut: JSON.parse(JSON.stringify(roughCut.clips.value)),
          frame: { ...roughCut.frameSettings.value },
          studio: JSON.parse(JSON.stringify(roughCut.studio.value))
        }
      : {}),
    ...(isImage.value
      ? {}
      : {
          watermark:
            mode !== "restore" && watermarkInput.value
              ? { ...watermarkInput.value, settings: JSON.parse(JSON.stringify(watermarkSettings.value)) }
              : null
        }),
    previewStartSeconds: 0,
    previewFullLength: mode === "preview",
    ...(isImage.value
      ? {
          slideshow: {
            images: props.item.media
              .filter((entry) => entry.kind === "image" && !entry.frameSourceMediaId)
              .map((entry) => ({ id: entry.id, checksum: entry.checksum })),
            secondsPerImage: secondsPerImage.value,
            aspect: aspect.value
          }
        }
      : {}),
    ...(chosenMusic.value && musicId.value !== "__saved__"
      ? { musicId: chosenMusic.value.id, musicRevision: chosenMusic.value.revision }
      : {})
  };
  if (!isImage.value && mode !== "restore") {
    input.studio = { ...input.studio!, unified: true };
    input.settings = {
      ...settings,
      originalVolume: input.studio.masterVolume ?? settings.originalVolume,
      musicVolume: 0
    };
    input.useSavedMusic = false;
    delete input.musicId;
    delete input.musicRevision;
    delete input.sourceMusicId;
    delete input.sourceMusicChecksum;
    input.watermark = null;
  }
  try {
    if (input.studio)
      input.studio = prepareSubtitleExport(input.studio, virtualPreview.value.width, virtualPreview.value.height);
    const result = await videoEditApi.create(props.item.id, current.value.id, input, scope.signal);
    if (version !== generation || scope.signal.aborted) return;
    job.value = result;
    if (exporting) {
      exportJobId.value = result.id;
      exportedUrl.value = "";
    }
    schedulePoll(version);
    return result.id;
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  } finally {
    if (version === generation) submitting.value = false;
  }
}
function schedulePoll(version: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void poll(version), 750);
}
async function poll(version: number) {
  if (!job.value || scope.signal.aborted || version !== generation) return;
  const jobId = job.value.id;
  try {
    const result = await videoEditApi.get(jobId, scope.signal);
    if (scope.signal.aborted || version !== generation || job.value?.id !== jobId) return;
    job.value = result;
    if (["pending", "running"].includes(result.status)) schedulePoll(version);
    else if (result.status === "completed") {
      if (result.mode === "preview" && result.previewUrl) {
        if (result.id === exportJobId.value) exportedUrl.value = resolveBackendUrl(result.previewUrl + "?download=1");
        else {
          previewUrl.value = resolveBackendUrl(result.previewUrl);
          previewIsDraft.value = true;
        }
      } else {
        // 终态与详情同步视为同一次操作，避免旧版本尚未回写就接受下一次保存。
        syncingResult.value = true;
        try {
          const item = await contentArchiveApi.detail(props.item.id, scope.signal);
          if (scope.signal.aborted || version !== generation || job.value?.id !== jobId) return;
          if (isImage.value) emit("update:show", false);
          else applyMedia(item.media.find((entry) => entry.id === (result.resultMediaId ?? props.mediaId)));
          emit("saved", item);
        } finally {
          if (version === generation) syncingResult.value = false;
        }
      }
    }
    if (result.status === "failed") error.value = result.message;
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  }
}
async function cancel() {
  if (!job.value) return;
  const version = generation;
  try {
    const result = await videoEditApi.cancel(job.value.id, scope.signal);
    if (version === generation && !scope.signal.aborted) job.value = result;
  } catch (e) {
    if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  }
}
async function restore() {
  const version = generation;
  if (
    await confirm("将原片设为最新版本，移除当前成品的剪辑、配乐和水印。", {
      title: "恢复原始视频",
      positiveText: "恢复原片"
    })
  )
    if (version === generation && !scope.signal.aborted) await submit("restore");
}
async function canLeave() {
  await roughCut.flush();
  if (roughCut.draftStatus.value === "草稿保存失败") return false;
  const version = generation;
  if (
    !activeJob.value &&
    initialized.value &&
    recipe.value !== initialRecipe.value &&
    !(await confirm("整个工程草稿会自动保留。未生成成品的修改不会应用到最新视频或关联归档。", {
      title: "关闭视频编辑",
      positiveText: "关闭窗口",
      danger: false
    }))
  )
    return false;
  return version === generation && !scope.signal.aborted;
}
async function close() {
  if (await canLeave()) emit("update:show", false);
}
defineExpose({ canLeave, close });
</script>

<style scoped>
.inspector-empty {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 18px 8px;
  line-height: 1.7;
}
.audio-editor {
  width: min(1120px, calc(100vw - 32px));
}
.audio-editor.is-embedded {
  width: 100%;
  max-height: none;
}
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(340px, 26vw, 560px);
  gap: 24px;
  margin: 16px 0;
}
.editor-layout.is-portrait {
  grid-template-columns: minmax(260px, 0.85fr) minmax(360px, 1.15fr);
}
.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.preview-toolbar :deep(.n-select) {
  width: 160px;
  margin-left: auto;
}
.editor-preview,
.editor-controls {
  min-width: 0;
}
.editor-preview :deep(.video-stage) {
  background: #101418;
  border-radius: 10px;
  height: clamp(280px, 56vh, 680px);
  overflow: hidden;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.editor-preview :deep(video) {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 56vh;
  background: #101418;
  border-radius: 10px;
  display: block;
  margin: 0 auto;
  object-fit: contain;
}
/* 画布与原生视频共同服从预览容器尺寸，避免内部 vh 上限高于容器。 */
.editor-preview :deep(.video-stage > video),
.editor-preview :deep(.video-stage > .cut-picture) {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 0 1 auto;
  object-fit: contain;
  margin: 0;
}
.slideshow-image {
  width: 100%;
  max-height: 56vh;
  object-fit: contain;
  background: #f1f5f9;
}
.editor-controls {
  height: clamp(360px, 68vh, 780px);
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 14px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface, #fff);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-controls > * {
  flex-shrink: 0;
}
.editor-controls label {
  display: grid;
  gap: 8px;
}
.editor-controls audio {
  width: 100%;
}
.editor-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0;
}
.editor-actions :deep(.n-input-number) {
  width: 130px;
}
.editor-actions :deep(.n-select),
.editor-actions :deep(.n-input) {
  flex: 1;
  min-width: 130px;
}
.editor-fades {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.editor-footer {
  justify-content: flex-end;
}
.editor-hint,
small {
  color: var(--text-secondary, var(--color-text-secondary));
  line-height: 1.7;
}
@media (max-width: 800px) {
  .editor-layout,
  .editor-layout.is-portrait {
    grid-template-columns: 1fr;
  }
}

.is-workbench .editor-layout {
  grid-template-columns:
    minmax(var(--workspace-left-min, 300px), var(--workspace-left)) 8px minmax(240px, 1fr)
    8px minmax(var(--workspace-right-min, 380px), var(--workspace-right));
  gap: 0;
  height: var(--workspace-top);
  margin-bottom: 0;
}
.is-workbench .editor-controls,
.editor-materials {
  height: 100%;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  box-sizing: border-box;
  background: var(--color-surface, #fff);
}
.editor-materials .material-tabs {
  position: sticky;
  top: -12px;
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 0;
  background: var(--color-surface, #fff);
  border-bottom: 1px solid var(--color-border);
}
.editor-materials {
  min-width: var(--workspace-left-min, 300px);
}
.is-workbench .editor-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 0 8px;
  box-sizing: border-box;
  overflow: auto;
}
.preview-heading {
  padding: 8px 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}
.is-workbench .editor-preview :deep(.video-stage) {
  flex: 1;
  min-height: 140px;
  height: auto;
  overflow: hidden;
}
.preview-transport {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  min-height: 28px;
  flex-shrink: 0;
  font-size: 11px;
}
.transport-clock {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.transport-end {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}
.aspect-badge {
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 1px 5px;
  min-width: 34px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
.aspect-badge:disabled {
  opacity: 0.5;
  cursor: default;
}
.aspect-badge:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}
.workspace-divider {
  background: transparent;
  touch-action: none;
  position: relative;
}
.workspace-divider:hover,
.workspace-divider:focus-visible {
  background: var(--color-primary-100, #eeeaff);
  outline: 1px solid var(--color-primary-600);
}
.workspace-divider.vertical {
  cursor: col-resize;
}
.workspace-divider.horizontal {
  height: 10px;
  cursor: row-resize;
}
.editor-preview:fullscreen,
.is-workbench .editor-preview:fullscreen {
  background: #101418;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  max-width: none;
  max-height: none;
  min-height: 0;
  box-sizing: border-box;
  padding: 0;
  gap: 0;
  color: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.editor-preview:fullscreen :deep(.video-stage) {
  flex: 1;
  min-height: 0;
  height: auto;
}
.editor-preview:fullscreen .editor-actions,
.editor-preview:fullscreen .preview-heading,
.editor-preview:fullscreen > p,
.editor-preview:fullscreen > button {
  display: none;
}
.editor-preview:fullscreen :deep(.n-button) {
  color: white;
}
.editor-preview:fullscreen .preview-transport {
  color: white;
  padding: 4px 12px;
}
.editor-preview:fullscreen .aspect-badge {
  color: inherit;
}
.editor-preview:fullscreen :deep(.cut-picture),
.editor-preview:fullscreen :deep(video) {
  max-height: 100%;
}
@media (max-width: 1100px) {
  .is-workbench .editor-layout {
    grid-template-columns:
      minmax(var(--workspace-left-min, 300px), var(--workspace-left)) 6px minmax(220px, 1fr)
      6px minmax(var(--workspace-right-min, 380px), var(--workspace-right));
  }
}
@media (max-width: 800px) {
  .is-workbench .editor-layout {
    grid-template-columns: 1fr;
    height: auto;
    gap: 12px;
  }
  .workspace-divider.vertical {
    display: none;
  }
  .editor-materials {
    max-height: 320px;
  }
  .is-workbench .editor-preview {
    height: 420px;
  }
  .is-workbench .editor-controls {
    height: 420px;
  }
}

.preview-canvas-bounds {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.is-workbench .preview-canvas-bounds :deep(.video-stage) {
  overflow: visible;
  flex: none;
  min-height: 0;
  border-radius: 0;
}
.editor-preview:fullscreen .preview-canvas-bounds {
  flex: 1;
  min-height: 0;
}
.preview-canvas-bounds :deep(.cut-picture),
.preview-canvas-bounds :deep(video) {
  border-radius: 0;
}
.preview-black-frame {
  display: grid;
  place-items: center;
  background: #000;
  overflow: visible;
  min-width: 0;
  min-height: 0;
}

/* 调整面板时只伸缩滑轨和布局空隙，数值输入框保持固定尺寸。 */
.editor-controls :deep(.n-input-number),
.editor-materials :deep(.n-input-number) {
  width: var(--editor-number-width, 126px);
  min-width: var(--editor-number-width, 126px);
  max-width: var(--editor-number-width, 126px);
  flex: 0 0 var(--editor-number-width, 126px);
}
.editor-controls :deep(.studio-grid),
.editor-materials :deep(.studio-grid),
.editor-controls :deep(.watermark-fields),
.editor-controls .editor-fades {
  grid-template-columns: repeat(auto-fit, minmax(126px, 1fr));
}

.is-workbench .editor-controls {
  min-width: var(--workspace-right-min, 380px);
}
.is-workbench .editor-layout {
  overflow-x: auto;
}
@media (max-width: 800px) {
  .is-workbench .editor-layout {
    grid-template-columns: minmax(var(--workspace-right-min, 380px), 1fr);
  }
}
</style>
