import fs from "node:fs/promises";
import path from "node:path";
import type { AudioLibraryItem } from "@toolbox/shared";
import { ToolboxDatabase } from "../../database/toolbox-database";
import { AudioLibraryStore } from "../../domains/audio-library/store";
import { createIsolatedAppFixture } from "./isolated-app";

/** Owns only an isolated library and synthetic metadata/bytes, never a user data root. */
export async function createAudioLibraryFixture() {
  const fixture = await createIsolatedAppFixture();
  let database: ToolboxDatabase;
  try {
    database = new ToolboxDatabase(":memory:");
  } catch (error) {
    await fixture.dispose();
    throw error;
  }
  const store = new AudioLibraryStore(fixture.layout.storageRoot, database, 1024);
  try {
    await store.initialize();
  } catch (error) {
    database.close();
    await fixture.dispose();
    throw error;
  }
  async function asset(id: string, groupId: string | null, trashed = false) {
    const bytes = Buffer.from(id);
    const item: AudioLibraryItem = {
      id,
      groupId,
      revision: 1,
      title: id,
      language: "und",
      foreignText: "Synthetic text",
      chineseText: "合成文案",
      note: "fixture",
      fileName: "audio.wav",
      mimeType: "audio/wav",
      bytes: bytes.length,
      duration: 1,
      sha256: "a".repeat(64),
      source: { kind: "upload", originalName: "fixture.wav" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...(trashed ? { deletedAt: "2026-01-02T00:00:00.000Z" } : {})
    };
    await fs.mkdir(path.dirname(store.file(item)), { recursive: true });
    await fs.writeFile(store.file(item), bytes);
    await store.mutate((c) => c.items.push(item));
    return item;
  }

  return {
    fixture,
    database,
    store,
    asset,
    async dispose() {
      database.close();
      await fixture.dispose();
    }
  };
}
