import { inject, type InjectionKey, type UnwrapNestedRefs } from "vue";
import type { ChatterboxPanelState } from "./useChatterboxPanel";

type ChatterboxPanelContext = UnwrapNestedRefs<ChatterboxPanelState>;

export const chatterboxPanelKey: InjectionKey<ChatterboxPanelContext> = Symbol("chatterbox-panel");

export function useChatterboxPanelContext() {
  const context = inject(chatterboxPanelKey);
  if (!context) {
    throw new Error("Chatterbox panel components must be rendered inside ChatterboxPanel");
  }
  return context;
}
