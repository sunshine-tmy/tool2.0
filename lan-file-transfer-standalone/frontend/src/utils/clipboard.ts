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
  focus: () => void;
  select: () => void;
};

type DocumentLike = {
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
    await clipboard.writeText(value);
    return;
  }

  const documentRef = options.documentRef ?? globalThis.document;
  if (!documentRef) {
    throw new Error("Clipboard is not available in this browser context");
  }

  const textarea = documentRef.createElement("textarea") as TextAreaLike;
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  documentRef.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    const copied = documentRef.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected");
    }
  } finally {
    documentRef.body.removeChild(textarea);
  }
}
