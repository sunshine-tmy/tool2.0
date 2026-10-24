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
import { registerContentArchiveRoutes } from "./core/routes";

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
    options.douyinRuntime
  );
  await service.initialize();
  registerContentArchiveRoutes(app, store.content, service.content);
  registerArchiveTranslationRoutes(app, store.content, translation, "media-archive");

  registerLegacyXhsArchiveRoutes({ app, store, service, auth, translation });

  app.addHook("onClose", async () => service.close());
  app.addHook("onClose", async () => auth.stop());
}
