export class ComponentManagerError extends Error {
  constructor(
    readonly code:
      | "COMPONENT_NOT_FOUND"
      | "COMPONENT_MANIFEST_INVALID"
      | "COMPONENT_IMPORT_INVALID"
      | "COMPONENT_INSTALL_FAILED"
      | "COMPONENT_DEPENDENCY_MISSING"
      | "COMPONENT_IN_USE"
      | "COMPONENT_DISK_SPACE_LOW"
      | "COMPONENT_JOB_NOT_FOUND"
      | "COMPONENT_JOB_NOT_CANCELLABLE"
      | "COMPONENT_OPERATION_CONFLICT"
      | "COMPONENT_NOT_INSTALLED",
    message: string
  ) {
    super(message);
    this.name = "ComponentManagerError";
  }
}
