/** Job algorithms operate on manager-owned maps; no separate store or lifecycle is introduced. */
import crypto from "node:crypto";
import type { ComponentJob, ComponentJobPhase, ComponentJobState, ComponentJobProgress } from "@toolbox/shared";
import type { InternalJob } from "./types";
import { ComponentManagerError } from "./component-error";
import { knownInstallFailure } from "./install-diagnostics";
type JobCollections = {
  jobs: Map<string, InternalJob>;
  listeners: Map<string, Set<(job: ComponentJob) => void>>;
  lastFailures: Map<string, { code: string; message: string }>;
  activeByComponent: Map<string, string>;
};
export function createComponentJob(
  collections: JobCollections,
  componentId: string,
  operation: ComponentJob["operation"],
  state: ComponentJobState,
  phase: ComponentJobPhase,
  totalDownloadBytes: number,
  totalFiles: number
): ComponentJob {
  pruneJobs(collections);
  const now = new Date().toISOString();
  const job: ComponentJob = {
    id: crypto.randomUUID(),
    componentId,
    operation,
    state,
    phase,
    progress: { downloadedBytes: 0, totalDownloadBytes, processedFiles: 0, totalFiles, percentage: 0 },
    createdAt: now,
    updatedAt: now
  };
  collections.jobs.set(job.id, { value: job });
  return job;
}

export function updateComponentJob(collections: JobCollections, internal: InternalJob, patch: Partial<ComponentJob>) {
  internal.value = { ...internal.value, ...patch, updatedAt: new Date().toISOString() };
  collections.jobs.set(internal.value.id, internal);
  for (const listener of collections.listeners.get(internal.value.id) ?? []) listener(internal.value);
}

export function failComponentJob(collections: JobCollections, internal: InternalJob, error: unknown) {
  const normalized =
    error instanceof ComponentManagerError
      ? error
      : new ComponentManagerError("COMPONENT_INSTALL_FAILED", safeErrorMessage(error));
  updateComponentJob(collections, internal, {
    state: "failed",
    phase: "complete",
    errorCode: normalized.code,
    errorMessage: normalized.message.slice(0, 240)
  });
  collections.lastFailures.set(internal.value.componentId, {
    code: normalized.code,
    message: normalized.message.slice(0, 240)
  });
  collections.activeByComponent.delete(internal.value.componentId);
  internal.controller = undefined;
}

export function subscribeComponentJob(
  collections: JobCollections,
  jobId: string,
  listener: (job: ComponentJob) => void
) {
  const listeners = collections.listeners.get(jobId) ?? new Set<(job: ComponentJob) => void>();
  listeners.add(listener);
  collections.listeners.set(jobId, listeners);
  const current = collections.jobs.get(jobId)?.value;
  if (current) listener(current);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) collections.listeners.delete(jobId);
  };
}
function pruneJobs(collections: JobCollections) {
  for (const [jobId, job] of collections.jobs) {
    if (collections.jobs.size < 500) break;
    const terminal = ["completed", "failed", "cancelled"].includes(job.value.state);
    if (terminal && !collections.listeners.has(jobId)) collections.jobs.delete(jobId);
  }
}
export function progress(
  downloadedBytes: number,
  totalDownloadBytes: number,
  processedFiles: number,
  totalFiles: number
): ComponentJobProgress {
  const percentage =
    totalDownloadBytes > 0 ? Math.min(100, Math.floor((downloadedBytes * 100) / totalDownloadBytes)) : 0;
  return { downloadedBytes, totalDownloadBytes, processedFiles, totalFiles, percentage };
}

export function zeroProgress(): ComponentJobProgress {
  return { downloadedBytes: 0, totalDownloadBytes: 0, processedFiles: 0, totalFiles: 0, percentage: 0 };
}

function safeErrorMessage(error: unknown) {
  const known = knownInstallFailure(error);
  if (known) return known;
  const message = error instanceof Error ? error.message : "能力包安装失败";
  return message
    .replace(/[A-Za-z]:\\[^\r\n'"]+/g, "[本地路径]")
    .replace(/(?:\/[^\s'"]+){2,}/g, "[本地路径]")
    .replace(/[\r\n]/g, " ")
    .slice(0, 200);
}
