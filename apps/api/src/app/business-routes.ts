/** Application assembly step; called directly on the original Fastify instance. */
import { type FastifyInstance } from "fastify";
import { type AppConfig } from "../config";
import { registerImageCompressRoutes } from "../domains/image-compress/routes";
import { registerImageAiRoutes } from "../domains/image-ai/routes";
import { registerEdgeTtsRoutes } from "../domains/speech/edge-tts";
import { registerChatterboxRoutes } from "../domains/speech/chatterbox/routes";
import { registerAudioLibraryRoutes } from "../domains/audio-library/routes";
import { registerLanTransferRoutes } from "../domains/lan-transfer/routes";
import { registerXhsArchiveRoutes } from "../domains/content-archive/routes";
import { registerMaintenanceRoutes } from "../modules/maintenance";
import { registerComponentRoutes } from "../modules/components/routes";
import { registerFrontendAssets } from "../plugins/frontend-assets";
import { registerMediaArchiveRuntimeRoutes } from "../domains/content-archive/runtime-routes";
import type { AppServices } from "./services";
export async function registerBusinessRoutes(app: FastifyInstance, config: AppConfig, services: AppServices) {
  const {
    database,
    fileMetadata,
    taskStore,
    remoteFetch,
    xhsStore,
    douyinRuntime,
    tiktokRuntime,
    xhsRuntime,
    xhsAuth,
    xhsTranslationRuntime,
    componentManager
  } = services;
  registerImageCompressRoutes(app, config, taskStore, fileMetadata);
  await registerImageAiRoutes(app, config, database, taskStore, fileMetadata);
  const edgeTtsBatches = await registerEdgeTtsRoutes({ app, config, database, taskStore, fileMetadata });
  const chatterboxArchive = await registerChatterboxRoutes(app, config, database, taskStore, fileMetadata);
  await registerAudioLibraryRoutes(app, config, database, chatterboxArchive.batches, edgeTtsBatches);
  await registerLanTransferRoutes({ app, config, database, fileMetadata });
  await registerXhsArchiveRoutes({
    app,
    config,
    remoteFetch,
    database,
    taskStore,
    fileMetadata,
    runtime: xhsRuntime,
    auth: xhsAuth,
    components: componentManager,
    translationRuntime: xhsTranslationRuntime,
    store: xhsStore,
    douyinRuntime,
    tiktokRuntime,
    profileReader: services.profileReader
  });
  registerMaintenanceRoutes(app, { config, database, xhsStore });
  registerComponentRoutes(app, componentManager, { allowOfflineImport: config.desktopManagedCapabilities });
  registerMediaArchiveRuntimeRoutes(app, douyinRuntime, tiktokRuntime);
  await registerFrontendAssets(app, { root: config.runtime.frontendDistRoot });
}
