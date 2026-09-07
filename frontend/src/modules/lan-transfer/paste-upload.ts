type ClipboardFiles = { files?: ArrayLike<File> | null } | null | undefined;

export function filesFromClipboard(data: ClipboardFiles) {
  return Array.from(data?.files ?? []).filter((file): file is File => Boolean(file));
}

export function isEditablePasteTarget(target: EventTarget | null) {
  if (!target || typeof target !== "object") return false;
  const element = target as {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  };
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable === true ||
    Boolean(element.closest?.('[contenteditable="true"]'))
  );
}
