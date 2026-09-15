import { onScopeDispose } from "vue";

/**
 * Owns one AbortController for a component/composable scope.
 *
 * Requests started by a page can share the returned signal. Vue disposes the
 * scope on route changes and component unmounts, which makes cancellation
 * deterministic and keeps late responses from outliving their owner.
 */
export function useRequestScope() {
  const controller = new AbortController();

  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  onScopeDispose(abort);

  return {
    signal: controller.signal,
    abort,
    get aborted() {
      return controller.signal.aborted;
    }
  };
}
