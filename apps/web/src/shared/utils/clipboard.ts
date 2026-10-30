/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
type ClipboardLike = {
  writeText: (value: string) => Promise<void>;
};

type TextAreaLike = Node & {
  value: string;
  style: {
    position: string;
    left: string;
    top: string;
  };
  focus: (options?: FocusOptions) => void;
  select: () => void;
};

type DocumentLike = {
  activeElement?: Element | null;
  body: {
    appendChild: (element: TextAreaLike) => void;
    removeChild: (element: TextAreaLike) => void;
  };
  createElement: (tagName: "textarea") => TextAreaLike;
  execCommand: (command: "copy") => boolean;
};

type CopyOptions = {
  clipboard?: ClipboardLike;
  documentRef?: DocumentLike;
};

export async function copyTextToClipboard(value: string, options: CopyOptions = {}) {
  const clipboard = options.clipboard ?? globalThis.navigator?.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      // Clipboard API may exist but reject writes for HTTP LAN origins or missing browser permission.
      // Continue to the legacy selection-based fallback instead of treating that as a hard failure.
    }
  }

  const documentRef = options.documentRef ?? globalThis.document;
  if (!documentRef) {
    throw new Error("Clipboard is not available in this browser context");
  }

  const textarea = documentRef.createElement("textarea") as TextAreaLike;
  const previousFocus = documentRef.activeElement;
  // Drawers and modals trap focus. A body-level textarea would lose its selection to that trap.
  const container =
    previousFocus?.closest('[role="dialog"], [aria-modal="true"]') ??
    (previousFocus === documentRef.body ? undefined : previousFocus?.parentElement) ??
    documentRef.body;
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  container.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (documentRef.activeElement && !documentRef.activeElement.isSameNode(textarea)) {
      throw new Error("The copy selection could not receive focus");
    }
    const copied = documentRef.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected");
    }
  } finally {
    container.removeChild(textarea);
    if (typeof HTMLElement !== "undefined" && previousFocus instanceof HTMLElement && previousFocus.isConnected)
      previousFocus.focus({ preventScroll: true });
  }
}
