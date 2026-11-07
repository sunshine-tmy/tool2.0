/** 归档编辑仅查询背景音乐，不接管音频库页面或全局播放队列。 */
import { audioLibraryApi } from "../api";
export { default as ArchiveMusicWaveform } from "../AudioWaveform.vue";
export const archiveMusicLibraryApi = {
  list: (params: Record<string, unknown> = {}, signal?: AbortSignal) =>
    audioLibraryApi.list({ ...params, view: "music" }, signal),
  upload: audioLibraryApi.upload,
  item: audioLibraryApi.item
};
