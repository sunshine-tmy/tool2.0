import { ref } from "vue";
import { snapVolume, volumeTooltip } from "./editor-numbers";
/** 按屏幕像素设置磁吸距离，避免窄面板上的 0 dB 吸附不足一像素。 */
export function useEditorVolumeSnap(apply: (db: number) => void) {
  const host = ref<HTMLElement>(),
    latched = ref(false);
  function position(db: number) {
    const width = Math.max(1, host.value?.clientWidth ?? 200);
    const acquire = Math.min(4, Math.max(0.75, (6 * 81) / width));
    const release = Math.min(6, Math.max(1.2, (10 * 81) / width));
    return Math.abs(db) <= (latched.value ? release : acquire) ? 0 : db < -60 ? -61 : db;
  }
  function update(db: number) {
    const snapped = position(db);
    latched.value = snapped === 0;
    apply(snapped);
  }
  function reset() {
    latched.value = false;
  }
  return { host, update, reset, tooltip: (db: number) => volumeTooltip(position(db)) };
}
