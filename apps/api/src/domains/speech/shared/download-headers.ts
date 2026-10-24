/** Preserve existing speech download header encoding. */
export function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replaceAll('"', "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
