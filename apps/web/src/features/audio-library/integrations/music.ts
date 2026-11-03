/** 归档编辑只消费素材通信接口，不接管音频库页面或全局播放队列。 */
import { audioLibraryApi } from "../api";
export { default as ArchiveMusicWaveform } from "../AudioWaveform.vue";
export const archiveMusicLibraryApi = {
  list: audioLibraryApi.list,
  upload: audioLibraryApi.upload,
  item: audioLibraryApi.item
};
