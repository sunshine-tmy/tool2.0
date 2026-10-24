import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";

/** Mount lifecycle-owning state in a real component scope; callers must unmount. */
export function mountComposable<T>(create: () => T) {
  let state!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = create();
        return () => h("div");
      }
    })
  );
  return { state, wrapper };
}
