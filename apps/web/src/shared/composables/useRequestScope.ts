/**
 * 中文模块说明：前端应用层，负责 页面级 AbortController 和请求资源释放
 */
import { onScopeDispose } from "vue";

/**
 * 为一个组件或 composable 创建独立的 AbortController。
 *
 * 页面发起的请求可以共享同一个 signal；Vue 路由切换或组件卸载时会销毁作用域，
 * 从而确定性地中止请求，避免迟到的响应继续修改已经离开的页面。
 */
export function useRequestScope() {
  const controller = new AbortController();

  const abort = () => {
    // abort() 允许被页面卸载钩子和业务取消按钮重复调用，因此需要保持幂等。
    if (!controller.signal.aborted) controller.abort();
  };

  // 将控制器绑定到当前 Vue effect scope，调用方无需单独记忆卸载时机。
  onScopeDispose(abort);

  return {
    signal: controller.signal,
    abort,
    get aborted() {
      return controller.signal.aborted;
    }
  };
}
