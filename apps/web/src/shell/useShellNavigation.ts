import { watch } from "vue";
import { useRoute } from "vue-router";
import {
  AudioLines,
  FileArchive,
  ImageDown,
  LibraryBig,
  ScanLine,
  Braces,
  Binary,
  Link,
  Fingerprint
} from "lucide-vue-next";
export function useShellNavigation() {
  const route = useRoute();
  const iconByTool: Record<string, unknown> = {
    "image-compress": ImageDown,
    "image-ai": ScanLine,
    "lan-transfer": FileArchive,
    "edge-tts": AudioLines,
    "audio-library": AudioLines,
    "audio-convert": AudioLines,
    "audio-extract": AudioLines,
    "xhs-archive": LibraryBig,
    "video-subtitle": ScanLine,
    "json-format": Braces,
    base64: Binary,
    "url-codec": Link,
    "uuid-generator": Fingerprint
  };

  function rememberTool(path: string) {
    // Keep the existing key and legacy archive path compatibility. Never block navigation when storage is denied.
    if (path.startsWith("/tools/")) {
      try {
        localStorage.setItem("toolbox:last-tool", path);
      } catch {
        /* Optional preference only. */
      }
    }
  }
  function startNavigation() {
    rememberTool(route.path);
  }
  watch(() => route.path, rememberTool);
  return { iconByTool, startNavigation };
}
