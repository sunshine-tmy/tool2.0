import type { AudioLibraryCatalog } from "@toolbox/shared";
import { reject } from "./errors";

export function audioLibraryUsedBytes(catalog: AudioLibraryCatalog) {
  return (
    catalog.items.reduce((sum, item) => sum + item.bytes, 0) +
    catalog.pendingDeletes.reduce((sum, item) => sum + item.bytes, 0)
  );
}

export function audioLibraryReservedBytes(reservations: ReadonlyMap<string, number>) {
  return [...reservations.values()].reduce((a, b) => a + b, 0);
}

// Keep invalid-input short circuiting before the caller reads any usage state.
export function assertAudioLibraryReservation(bytes: number, wouldExceed: () => boolean) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || wouldExceed())
    reject("AUDIO_LIBRARY_QUOTA_EXCEEDED", "音频库空间不足，请清理回收站或调整容量", 413);
}

export function exceedsAudioLibraryCommitQuota(
  usedBytes: number,
  reservedBytes: number,
  ownReservation: number,
  incomingBytes: number,
  maxBytes: number
) {
  return usedBytes + reservedBytes - ownReservation + incomingBytes > maxBytes;
}
