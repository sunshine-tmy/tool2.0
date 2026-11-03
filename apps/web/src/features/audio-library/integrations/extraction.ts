/** Read-only communication port for the extractor; the application player remains owned by the library. */
import { audioLibraryApi } from "../api";
export { default as ExtractionAudioWaveform } from "../AudioWaveform.vue";
export { formatDuration as formatAudioDuration } from "../presentation";
export { vSliderLabel } from "../slider-label";
export const extractionLibraryApi = { list: audioLibraryApi.list };
