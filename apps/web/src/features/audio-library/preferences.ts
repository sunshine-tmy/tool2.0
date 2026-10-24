import { apiBaseUrl } from "../../shared/config/runtime";
export function storedGroup(key = "last-group"): string | null {
  try {
    return localStorage.getItem(`audio-library:${apiBaseUrl}:${key}`) || null;
  } catch {
    return null;
  }
}
export function rememberGroup(value: string | null, key = "last-group") {
  try {
    if (value) localStorage.setItem(`audio-library:${apiBaseUrl}:${key}`, value);
    else localStorage.removeItem(`audio-library:${apiBaseUrl}:${key}`);
  } catch {
    /* 浏览器禁用存储时仍可正常归档。 */
  }
}
