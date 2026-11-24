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
      | "COMPONENT_NOT_INSTALLED"
      | "COMPONENT_VERSION_MISMATCH"
      | "COMPONENT_FILE_MISSING"
      | "COMPONENT_FILE_SIZE_MISMATCH"
      | "COMPONENT_FILE_HASH_MISMATCH"
      | "COMPONENT_PATH_INVALID",
    message: string
  ) {
    super(message);
    this.name = "ComponentManagerError";
  }
}
