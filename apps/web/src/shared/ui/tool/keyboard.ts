export function isEditingText(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")))
  );
}

export function hasOpenModal() {
  return [...document.querySelectorAll<HTMLElement>("[role='dialog'], [aria-modal='true'], .n-modal, .n-drawer")].some(
    (dialog) => {
      for (let node: HTMLElement | null = dialog; node; node = node.parentElement) {
        if (node.hidden || node.getAttribute("aria-hidden") === "true") return false;
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    }
  );
}
