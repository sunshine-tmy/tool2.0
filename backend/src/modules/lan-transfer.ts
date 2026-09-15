import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import {
  LanAccessInputSchema,
  LanAccessResultSchema,
  LanTransferInfoSchema,
  apiSuccessSchema,
  fail,
  ok
} from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "../database/toolbox-database";
import type { FileMetadataRepository } from "../database/file-metadata";
import { REQUEST_QUOTAS } from "../security/request-quotas";
import {
  createLanAccessController,
  createLanAuditLog,
  getLanWebUrls,
  type LanAccessController
} from "./lan-transfer/access";
import { registerLanFileRoutes } from "./lan-transfer/file-routes";
import { registerLanNoteRoutes } from "./lan-transfer/note-routes";
import { registerLanChunkRoutes } from "./lan-transfer/chunk-routes";
import { createLanFileStore, createLanNoteStore } from "./lan-transfer/repositories";
import { createLanUploadStore } from "./lan-transfer/uploads";
import { lanFailureResponses } from "./lan-transfer/route-contract";

type RegisterLanTransferRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  database: ToolboxDatabase;
  fileMetadata?: FileMetadataRepository;
};

export async function registerLanTransferRoutes({
  app,
  config,
  database,
  fileMetadata
}: RegisterLanTransferRoutesOptions) {
  const store = createLanFileStore(config, database, fileMetadata);
  const noteStore = createLanNoteStore(config, database, fileMetadata);
  const uploadStore = createLanUploadStore(config, database);
  const finalizingUploads = new Set<string>();
  const access = createLanAccessController(config);
  const audit = createLanAuditLog(database);
  await store.ensure();
  await noteStore.ensure();
  await uploadStore.ensure();
  await store.cleanupExpired();
  await noteStore.cleanupExpired();
  await uploadStore.cleanupStale(config.lanTransferUploadRetentionHours);

  registerLanTransferNamespace(
    app,
    config,
    store,
    noteStore,
    uploadStore,
    finalizingUploads,
    access,
    audit,
    "/api/v1/tools/lan-transfer"
  );

  const cleanupTimer = setInterval(
    () => {
      Promise.all([
        store.cleanupExpired(),
        noteStore.cleanupExpired(),
        uploadStore.cleanupStale(config.lanTransferUploadRetentionHours, finalizingUploads)
      ])
        .then(([files, notes, uploads]) => {
          if (files.removed + notes.removed + uploads.removed <= 0) return;
          database.appendAudit({
            action: "lan.cleanup.scheduled",
            outcome: "success",
            details: { filesRemoved: files.removed, notesRemoved: notes.removed, uploadsRemoved: uploads.removed }
          });
        })
        .catch(() => undefined);
    },
    config.lanTransferCleanupIntervalMinutes * 60 * 1000
  );
  cleanupTimer.unref();
  app.addHook("onClose", async () => clearInterval(cleanupTimer));
}

function registerLanTransferNamespace(
  app: FastifyInstance,
  config: AppConfig,
  store: ReturnType<typeof createLanFileStore>,
  noteStore: ReturnType<typeof createLanNoteStore>,
  uploadStore: ReturnType<typeof createLanUploadStore>,
  finalizingUploads: Set<string>,
  access: LanAccessController,
  audit: ReturnType<typeof createLanAuditLog>,
  basePath: string
) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.get(
    `${basePath}/info`,
    { schema: { response: { 200: apiSuccessSchema(LanTransferInfoSchema), ...lanFailureResponses } } },
    async (request) => {
      const fileBytes = await store.totalSize();
      const noteBytes = await noteStore.totalSize();
      const reservedUploadBytes = await uploadStore.totalDeclaredSize();
      return ok({
        lanUrls: getLanWebUrls(config.lanTransferWebPort),
        retentionDays: config.lanTransferRetentionDays,
        maxFileBytes: config.lanTransferMaxFileBytes,
        maxStorageBytes: config.lanTransferMaxStorageBytes,
        usedBytes: fileBytes + noteBytes,
        noteCount: await noteStore.count(),
        reservedUploadBytes,
        pinRequired: Boolean(config.lanTransferPin),
        guestMode: config.lanTransferGuestMode,
        authenticated: access.isAuthenticated(request)
      });
    }
  );

  typedApp.post(
    `${basePath}/access`,
    {
      config: { ...REQUEST_QUOTAS.login, allowGuestTransfer: true },
      schema: {
        body: LanAccessInputSchema,
        response: { 200: apiSuccessSchema(LanAccessResultSchema), ...lanFailureResponses }
      }
    },
    async (request, reply) => {
      const token = access.login(request.body.pin);
      if (!token) {
        await audit.write("access.denied", request);
        return reply.code(401).send(fail("INVALID_LAN_PIN", "访问 PIN 不正确"));
      }
      await audit.write("access.granted", request);
      reply.header("set-cookie", access.sessionCookie(token));
      return ok({ authenticated: true });
    }
  );

  typedApp.delete(
    `${basePath}/access`,
    {
      config: { allowGuestTransfer: true },
      schema: { response: { 200: apiSuccessSchema(LanAccessResultSchema), ...lanFailureResponses } }
    },
    async (request, reply) => {
      access.logout(request);
      reply.header("set-cookie", access.expiredSessionCookie());
      return ok({ authenticated: false });
    }
  );

  registerLanNoteRoutes({ app, config, store, noteStore, uploadStore, access, audit, basePath });

  registerLanFileRoutes({ app, config, store, noteStore, uploadStore, access, audit, basePath });
  registerLanChunkRoutes({ app, config, store, noteStore, uploadStore, finalizingUploads, access, audit, basePath });
}
