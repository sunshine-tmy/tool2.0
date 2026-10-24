export function isTrustedBackendUrl(url: string, origin: string) {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(url: string) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
