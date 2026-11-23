import { expect, it } from "vitest";
import { getConfig } from "../config";
import { desktopServiceEnvironment, DESKTOP_SERVICE_PORTS } from "../runtime/desktop-service-ports";
import { createDesktopWorkerSession, workerSessionEnvironment } from "../runtime/worker-session";

const development = {
  API_HOST: "0.0.0.0",
  API_PORT: "3100",
  LAN_TRANSFER_WEB_PORT: "5173",
  XHS_PROVIDER_PORT: "5556",
  XHS_TRANSLATION_PROVIDER_PORT: "5557",
  XHS_PROVIDER_URL: "http://127.0.0.1:5556",
  XHS_TRANSLATION_PROVIDER_URL: "http://127.0.0.1:5557",
  IMAGE_AI_WORKER_URL: "http://127.0.0.1:3210",
  VIDEO_AI_WORKER_URL: "http://127.0.0.1:3211",
  CHATTERBOX_WORKER_URL: "http://127.0.0.1:3220"
};
it("isolates desktop service defaults and provider addresses without changing development configuration", () => {
  const desktop = getConfig({
    dotenvPath: false,
    desktopManagedCapabilities: true,
    environment: desktopServiceEnvironment(development)
  });
  expect(desktop).toMatchObject({
    host: "127.0.0.1",
    port: DESKTOP_SERVICE_PORTS.api,
    lanTransferWebPort: 46373,
    xhsProviderPort: 46356,
    xhsTranslationProviderPort: 46357
  });
  expect(desktop.xhsProviderUrl).toBeUndefined();
  expect(desktop.xhsTranslationProviderUrl).toBeUndefined();
  expect([desktop.imageAiWorkerUrl, desktop.videoAiWorkerUrl, desktop.chatterboxWorkerUrl]).toEqual(
    Array(3).fill("http://127.0.0.1:1")
  );
  const source = getConfig({ dotenvPath: false, environment: development });
  expect(source).toMatchObject({
    port: 3100,
    lanTransferWebPort: 5173,
    xhsProviderPort: 5556,
    xhsTranslationProviderPort: 5557
  });
  expect(development.API_PORT).toBe("3100");
});

it("uses the reserved session worker ports and supports a desktop-specific LAN override", async () => {
  const session = await createDesktopWorkerSession();
  const desktop = getConfig({
    dotenvPath: false,
    desktopManagedCapabilities: true,
    environment: {
      ...desktopServiceEnvironment({ ...development, TOOLBOX_DESKTOP_LAN_PORT: "46380" }),
      ...workerSessionEnvironment(session)
    }
  });
  expect(desktop.lanTransferWebPort).toBe(46380);
  expect(desktop.xhsProviderPort).toBe(session.xhsProviderPort);
  expect(desktop.xhsTranslationProviderPort).toBe(session.xhsTranslationPort);
  expect(desktop.xhsProviderPort).not.toBe(desktop.xhsTranslationProviderPort);
});
