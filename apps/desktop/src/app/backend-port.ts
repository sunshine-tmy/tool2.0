import type { BackendSupervisor } from "../backend/backend-supervisor";
export type DesktopBackend = Pick<BackendSupervisor, "start" | "stop" | "inspectShutdown" | "monitorUnexpectedExit">;
