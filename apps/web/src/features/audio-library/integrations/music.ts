/** 归档编辑仅查询背景音乐，不接管音频库页面或全局播放队列。 */
import { audioLibraryApi } from "../api";
export { default as ArchiveMusicWaveform } from "../AudioWaveform.vue";
export const archiveMusicLibraryApi = {
  list: (params: Record<string, unknown> = {}, signal?: AbortSignal) =>
    audioLibraryApi.list({ ...params, view: "music" }, signal),
  upload: audioLibraryApi.upload,
  item: audioLibraryApi.item
};

export {
  loadWaveformData as loadArchiveMusicWaveform,
  type WaveformData as ArchiveMusicWaveformData
} from "../waveform-peaks";

/** 编辑器音频素材页可查询全部未删除素材，旧配乐选择器仍只查询背景音乐。 */
export const archiveEditorAudioApi = {
  list: (params: Record<string, unknown> = {}, signal?: AbortSignal) =>
    audioLibraryApi.list(
      { ...params, view: params.view === "music" || params.view === "speech" ? params.view : "all" },
      signal
    )
};
