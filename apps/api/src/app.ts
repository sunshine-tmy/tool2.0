/** Public backend application entry; assembly order is part of its compatibility contract. */
import type { FastifyInstance } from "fastify";
import { getConfig } from "./config";
import { DesktopShutdown } from "./lifecycle/desktop-shutdown";
import { registerLanApplicationAccess } from "./system/lan-access/routes";
import { registerDiagnosticRoutes } from "./modules/diagnostics/routes";
import type { AppOptions } from "./app/options";
import { createServer } from "./app/create-server";
import { createAppServices } from "./app/services";
import { registerRequestProtection } from "./app/request-protection";
import { registerAppLifecycle } from "./app/lifecycle";
import { registerBasePlugins } from "./app/plugins";
import { registerResponsePolicy } from "./app/responses";
import { prepareAppStorage, reconcilePersistentStorage } from "./app/storage";
import { registerSystemRoutes } from "./app/system-routes";
import { registerBusinessRoutes } from "./app/business-routes";

export async function createApp(options: AppOptions = {}) {
  const app = createServer();
  try {
    return await initializeApp(app, options);
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

async function initializeApp(app: FastifyInstance, options: AppOptions) {
  const config = options.config ?? getConfig();
  options.onStage?.("database");
  const services = await createAppServices(config, options.remoteAddressResolver);
  const { database, componentManager, diagnosticService } = services;
  const shutdown = options.shutdown ?? new DesktopShutdown();
  registerRequestProtection(app, shutdown, componentManager, diagnosticService);
  const taskEventStreams = registerAppLifecycle(app, options, services);
  await registerBasePlugins(app, config, database);
  registerLanApplicationAccess(app, config, diagnosticService);
  registerDiagnosticRoutes(app, diagnosticService);
  registerResponsePolicy(app);
  const requiredStorageDirectories = await prepareAppStorage(app, config, database, options);
  registerSystemRoutes(app, config, database, services.taskStore, requiredStorageDirectories, taskEventStreams);
  await registerBusinessRoutes(app, config, services);
  await reconcilePersistentStorage(app, config, database);
  return app;
}
