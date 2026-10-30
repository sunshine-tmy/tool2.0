/** Plain-text paste for the two smart-segmentation dialogs. Never read or insert clipboard HTML. */
import { nextTick } from "vue";
import { normalizeSpeechSegmentText } from "./chatterbox-segment-parser";

export function pasteSpeechText(event: ClipboardEvent, update: (value: string) => void) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement) || target.disabled || target.readOnly || !event.clipboardData) return;
  const text = event.clipboardData.getData("text/plain");
  if (!text) return;
  event.preventDefault();
  const start = target.selectionStart,
    end = target.selectionEnd,
    pasted = normalizeSpeechSegmentText(text);
  update(target.value.slice(0, start) + pasted + target.value.slice(end));
  // Wait for the controlled NInput to render, then restore the insertion caret.
  void nextTick(() => {
    if (target.isConnected) target.setSelectionRange(start + pasted.length, start + pasted.length);
  });
}
