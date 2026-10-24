import { diagnosticConnection } from "./diagnostic-connection";
export { diagnosticConnection } from "./diagnostic-connection";
import { DiagnosticRunSchema, DiagnosticReportSchema, type DiagnosticInput, type DiagnosticRun } from "@toolbox/shared";
import { httpClient } from "./http";
export const localDiagnosticsAvailable =
  typeof window === "undefined" || ["127.0.0.1", "localhost", "[::1]"].includes(window.location.hostname);

let pending: Promise<DiagnosticRun> | undefined;
let cached: DiagnosticRun | undefined;
let checkedAt = 0;
export const diagnosticsApi = {
  snapshot(force = false) {
    if (!force && cached && Date.now() - checkedAt < 10000) return Promise.resolve(cached);
    pending ??= httpClient
      .get("/diagnostics", DiagnosticRunSchema, { timeout: 10000 })
      .then((run) => {
        cached = run;
        checkedAt = Date.now();
        diagnosticConnection.value = run.checks.some((c) => ["failed", "warning", "unknown"].includes(c.status))
          ? "partial"
          : "online";
        return run;
      })
      .catch((error) => {
        diagnosticConnection.value = "offline";
        throw error;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  },
  start: (input: DiagnosticInput) =>
    httpClient.post("/diagnostics/runs", DiagnosticRunSchema, input, { timeout: 10000 }),
  get: (id: string) => httpClient.get(`/diagnostics/runs/${id}`, DiagnosticRunSchema),
  cancel: (id: string) => httpClient.delete(`/diagnostics/runs/${id}`, DiagnosticRunSchema),
  restart: (componentId: string) =>
    httpClient.post("/diagnostics/actions", DiagnosticRunSchema, {
      action: "restart-worker",
      componentId,
      confirmed: true
    }),
  report: (runId: string, includeEvents: boolean) =>
    httpClient.post("/diagnostics/reports", DiagnosticReportSchema, { runId, includeEvents })
};
