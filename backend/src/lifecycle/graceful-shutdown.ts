type ShutdownSignal = "SIGINT" | "SIGTERM";

type Closable = {
  close(): Promise<unknown>;
};

type SignalSource = {
  on(event: ShutdownSignal, listener: () => void): unknown;
  off(event: ShutdownSignal, listener: () => void): unknown;
};

type ShutdownOptions = {
  timeoutMs?: number;
  signalSource?: SignalSource;
  forceExit?: (code: number) => void;
  setExitCode?: (code: number) => void;
  logger?: Pick<Console, "info" | "error">;
};

export function installGracefulShutdown(app: Closable, options: ShutdownOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const signalSource = options.signalSource ?? process;
  const forceExit = options.forceExit ?? ((code: number) => process.exit(code));
  const setExitCode = options.setExitCode ?? ((code: number) => (process.exitCode = code));
  const logger = options.logger ?? console;
  let closing: Promise<void> | undefined;

  const shutdown = (signal: ShutdownSignal) => {
    if (closing) return closing;
    logger.info(`Received ${signal}; closing Toolbox API...`);
    closing = new Promise<void>((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        logger.error(`Graceful shutdown exceeded ${timeoutMs} ms; forcing process exit.`);
        forceExit(1);
      }, timeoutMs);
      timeout.unref();

      void app.close().then(
        () => {
          settled = true;
          clearTimeout(timeout);
          setExitCode(0);
          resolve();
        },
        (error: unknown) => {
          settled = true;
          clearTimeout(timeout);
          logger.error("Toolbox API shutdown failed.", error);
          setExitCode(1);
          resolve();
        }
      );
    });
    return closing;
  };

  const onSigint = () => void shutdown("SIGINT");
  const onSigterm = () => void shutdown("SIGTERM");
  signalSource.on("SIGINT", onSigint);
  signalSource.on("SIGTERM", onSigterm);

  return {
    shutdown,
    dispose() {
      signalSource.off("SIGINT", onSigint);
      signalSource.off("SIGTERM", onSigterm);
    }
  };
}
