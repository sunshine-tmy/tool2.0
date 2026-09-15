/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
import { useDialog } from "naive-ui";

interface ConfirmDialogOptions {
  title?: string;
  positiveText?: string;
  negativeText?: string;
  danger?: boolean;
}

export function useConfirmDialog() {
  const dialog = useDialog();

  return (content: string, options: ConfirmDialogOptions = {}) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (confirmed: boolean) => {
        // Naive UI 可能在关闭、点击按钮等多个回调中通知结果，统一保证 Promise 只结算一次。
        if (settled) return;
        settled = true;
        resolve(confirmed);
      };

      dialog.warning({
        // 删除和清理等高风险操作由调用方传入 danger=true，统一使用错误色并禁用误触关闭。
        title: options.title ?? "请确认操作",
        content,
        positiveText: options.positiveText ?? "确认",
        negativeText: options.negativeText ?? "取消",
        positiveButtonProps: { type: options.danger === false ? "primary" : "error" },
        closable: false,
        maskClosable: false,
        closeOnEsc: false,
        onPositiveClick: () => finish(true),
        onNegativeClick: () => finish(false)
      });
    });
}
