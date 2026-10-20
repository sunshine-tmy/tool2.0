import { inject, type InjectionKey, type UnwrapNestedRefs } from "vue";
import type { useEdgeTtsPanel } from "./useEdgeTtsPanel";
export const edgeTtsPanelKey: InjectionKey<UnwrapNestedRefs<ReturnType<typeof useEdgeTtsPanel>>> =
  Symbol("online-tts-panel");
export function useEdgeTtsPanelContext() {
  const panel = inject(edgeTtsPanelKey);
  if (!panel) throw new Error("Online speech panel context is missing");
  return panel;
}
