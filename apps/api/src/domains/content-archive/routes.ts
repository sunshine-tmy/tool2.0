/** Domain assembly keeps the original service ownership and Fastify registration/close order. */
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { TaskStore } from "../../tasks/task-store";
import type { RemoteFetch } from "../../security/remote-fetch";
import { XhsAuthManager } from "./providers/xiaohongshu/auth";
import { XhsRuntimeManager } from "./providers/xiaohongshu/runtime";
import { XhsArchiveStore } from "./compat/xhs/store";
import { XhsArchiveTaskService } from "./compat/xhs/task-service";
import { registerLegacyXhsArchiveRoutes } from "./compat/xhs/routes";
import { XhsTranslationRuntime } from "./core/translation-runtime";
import { ContentArchiveTranslationService } from "./core/translation-service";
import { registerArchiveTranslationRoutes } from "./core/translation-routes";
import type { ComponentManager } from "../../modules/components/component-manager";
import type { DouyinRuntimeManager } from "./providers/douyin/douyin-runtime";
import type { TikTokRuntime } from "./providers/tiktok/runtime";
import { registerContentArchiveRoutes } from "./core/routes";
import { ArchiveImportService } from "./batch/service";
import { registerArchiveImportRoutes } from "./batch/routes";
import { registerArchiveGroupRoutes } from "./core/group-routes";
import type { TikTokProfileReader } from "./providers/tiktok/profile-reader";
import { TikTokProfileService } from "./profile/service";
import { registerTikTokProfileRoutes } from "./profile/routes";
import { ArchiveTaskError } from "./core/provider";
import type { AudioLibraryStore } from "../audio-library/store";
import { ArchiveVideoEditService } from "./video-edit/service";
import { registerVideoEditRoutes } from "./video-edit/routes";
import { VideoEditError, runMediaProcess } from "./video-edit/renderer";
import { LocalVideoArchiveUploads, registerLocalVideoUploadRoutes } from "./core/local-upload";

export async function registerXhsArchiveRoutes(options: {
  app: FastifyInstance;
  config: AppConfig;
  remoteFetch: RemoteFetch;
  database: ToolboxDatabase;
  taskStore: TaskStore;
  fileMetadata?: FileMetadataRepository;
  runtime?: XhsRuntimeManager;
  auth?: XhsAuthManager;
  components?: ComponentManager;
  translationRuntime?: XhsTranslationRuntime;
  store?: XhsArchiveStore;
  douyinRuntime?: DouyinRuntimeManager;
  tiktokRuntime?: TikTokRuntime;
  profileReader?: TikTokProfileReader;
  audioLibrary?: AudioLibraryStore;
}) {
  const { app, config, remoteFetch, database, taskStore, fileMetadata } = options;
  const store = options.store ?? new XhsArchiveStore(config, database, fileMetadata);
  const runtime = options.runtime ?? new XhsRuntimeManager(config, options.components);
  const auth = options.auth ?? new XhsAuthManager(config, options.components);
  const translationRuntime = options.translationRuntime ?? new XhsTranslationRuntime(config, options.components);
  const translation = new ContentArchiveTranslationService(config, store.content, translationRuntime, taskStore);
  const service = new XhsArchiveTaskService(
    config,
    remoteFetch,
    store,
    runtime,
    auth,
    translation,
    taskStore,
    database,
    options.douyinRuntime,
    options.tiktokRuntime
  );
  await service.initialize();
  const videoEdits = new ArchiveVideoEditService({
    config,
    database,
    tasks: taskStore,
    store: store.content,
    music: {
      acquire: async (id, revision) => {
        if (!options.audioLibrary) throw new VideoEditError("ARCHIVE_EDIT_MUSIC_UNAVAILABLE", "音频素材库不可用", 503);
        const library = options.audioLibrary;
        const item = await library.item(id);
        if (item.deletedAt)
          throw new VideoEditError("ARCHIVE_EDIT_MUSIC_MISSING", "音乐已进入回收站，请恢复后选择", 404);
        if (revision !== undefined && item.revision !== revision)
          throw new VideoEditError("ARCHIVE_EDIT_MUSIC_CHANGED", "音乐已被修改，请重新选择", 409);
        return { item, file: library.file(item), release: library.pin([id]) };
      }
    },
    tools: async () => {
      let ffmpeg = config.chatterboxFfmpegPath,
        ffprobe = config.chatterboxFfprobePath;
      try {
        if (options.components) {
          const suffix = process.platform === "win32" ? ".exe" : "";
          [ffmpeg, ffprobe] = await Promise.all(
            ["ffmpeg", "ffprobe"].map(
              async (tool) => (await options.components!.resolveInstalledAsset("ffmpeg", `bin/${tool}${suffix}`)).path
            )
          );
        }
      } catch {
        if (config.desktopManagedCapabilities)
          throw new VideoEditError("ARCHIVE_EDIT_RUNTIME_UNAVAILABLE", "请先安装 FFmpeg 共享媒体运行时", 503);
      }
      if (!ffmpeg || !ffprobe)
        throw new VideoEditError("ARCHIVE_EDIT_RUNTIME_UNAVAILABLE", "请先安装 FFmpeg 共享媒体运行时", 503);
      try {
        await Promise.all(
          [ffmpeg, ffprobe].map((tool) =>
            runMediaProcess(tool, ["-version"], AbortSignal.timeout(5000), { timeoutMs: 5000 })
          )
        );
      } catch {
        throw new VideoEditError(
          "ARCHIVE_EDIT_RUNTIME_UNAVAILABLE",
          "FFmpeg 共享媒体运行时不可用，请检查能力管理",
          503
        );
      }
      return { ffmpeg, ffprobe };
    },
    onError: (error) => app.log.error({ err: error }, "archive video edit failed")
  });
  videoEdits.initialize();
  registerVideoEditRoutes(app, videoEdits, store.content);
  const localUploads = new LocalVideoArchiveUploads({
    config,
    store: store.content,
    tasks: taskStore,
    tools: () => videoEdits.mediaTools()
  });
  registerLocalVideoUploadRoutes(app, localUploads);
  const imports = new ArchiveImportService(database, store.content, service.content, {
    onError: () => app.log.error("ARCHIVE_IMPORT_STORAGE_FAILED")
  });
  imports.initialize();
  registerArchiveImportRoutes(app, imports);
  const profiles = new TikTokProfileService(
    database,
    imports,
    options.profileReader ?? {
      read: () => Promise.reject(new ArchiveTaskError("TIKTOK_PROFILE_BROWSER_UNAVAILABLE", "归档浏览器尚未就绪", 409))
    },
    { onError: () => app.log.error("TIKTOK_PROFILE_STORAGE_FAILED") }
  );
  profiles.initialize();
  registerTikTokProfileRoutes(app, profiles);
  registerArchiveGroupRoutes(app, store.content.groups);
  registerContentArchiveRoutes(app, store.content, service.content);
  registerArchiveTranslationRoutes(app, store.content, translation, "media-archive");

  registerLegacyXhsArchiveRoutes({ app, store, service, auth, translation });

  app.addHook("onClose", async () => {
    await localUploads.close();
    await videoEdits.close();
    await profiles.close();
    await imports.stop();
    try {
      await service.close();
    } finally {
      imports.recoverInterrupted();
      await store.content.flushVideoEdits();
    }
  });
  app.addHook("onClose", async () => auth.stop());
}
