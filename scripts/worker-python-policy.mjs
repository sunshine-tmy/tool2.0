/** 中文模块说明：新能力包统一使用 Python 3.12，拒绝误用旧 ABI 的二进制依赖。 */
const WORKER_PYTHON_VERSION = "3.12";

export function assertWorkerPythonVersion(version) {
  if (version.trim() !== WORKER_PYTHON_VERSION) {
    throw new Error(`新能力包必须使用 Python ${WORKER_PYTHON_VERSION} 环境，不能复用旧版 venv`);
  }
}

export function assertWorkerWheelPython(filename) {
  if (!filename.endsWith(".whl")) return;
  const match = /-([^-]+)-([^-]+)-([^-]+)\.whl$/.exec(filename);
  if (!match) throw new Error(`wheel 文件名无效：${filename}`);
  const [, pythonTags, abiTags] = match;
  const compatible = pythonTags.split(".").some((tag) => {
    if (tag === "py3" || tag === "py312") return abiTags === "none";
    if (tag === "cp312") return ["cp312", "abi3", "none"].includes(abiTags);
    // CPython 的 stable ABI 可以跨小版本使用，不能将合法 cp38-abi3 误报为旧环境。
    const stable = /^cp3(\d+)$/.exec(tag);
    return stable && Number(stable[1]) <= 12 && abiTags === "abi3";
  });
  if (!compatible) throw new Error(`wheel 与 Python ${WORKER_PYTHON_VERSION} 不兼容：${filename}`);
}

export function assertUnifiedPythonCatalog(catalog) {
  const manifests = catalog.manifests;
  if (manifests.some((manifest) => manifest.id === "python-311")) {
    throw new Error("统一能力目录不得包含旧 python-311 条目；不要删除用户已有安装");
  }
  for (const manifest of manifests) {
    const environment = manifest.pythonEnvironment;
    if (manifest.dependencyIds?.includes("python-311")) {
      throw new Error(`能力 ${manifest.id} 仍依赖 Python 3.11，不能发布统一目录`);
    }
    if (!environment) continue;
    if (
      environment.pythonComponentId !== "python-312" ||
      environment.expectedPythonVersion !== WORKER_PYTHON_VERSION ||
      !manifest.dependencyIds?.includes("python-312") ||
      !manifests.some((candidate) => candidate.id === "python-312")
    ) {
      throw new Error(`能力 ${manifest.id} 未使用 Python 3.12 共享运行时`);
    }
  }
}
