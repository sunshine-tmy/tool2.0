import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const workerSuites = {
  image: ["image-ai-worker.py", "image_ai_worker_test.py", "worker_lifecycle.py"],
  chatterbox: ["chatterbox-worker.py", "chatterbox-worker.test.py", "worker_lifecycle.py"]
};

export function isolatedEnvironment(root, inherited = process.env) {
  // Do not inherit storage/model paths, Python overrides, tokens or repository .env.
  const environment = Object.fromEntries(
    Object.entries(inherited).filter(([key]) =>
      /^(?:path|systemroot|windir|comspec|pathext|systemdrive|number_of_processors|processor_architecture|lang|lc_all)$/i.test(
        key
      )
    )
  );
  for (const name of ["TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "XDG_CACHE_HOME"])
    environment[name] = path.join(root, "temp");
  for (const name of ["STORAGE_ROOT", "IMAGE_AI_STORAGE_ROOT", "CHATTERBOX_STORAGE_ROOT"])
    environment[name] = path.join(root, "storage", name.toLowerCase());
  for (const name of [
    "IMAGE_AI_MODELS_ROOT",
    "CHATTERBOX_MODELS_ROOT",
    "HF_HOME",
    "TORCH_HOME",
    "U2NET_HOME",
    "PADDLE_PDX_CACHE_HOME"
  ])
    environment[name] = path.join(root, "models", name.toLowerCase());
  return {
    ...environment,
    PYTHONDONTWRITEBYTECODE: "1",
    PYTHONNOUSERSITE: "1",
    PYTHONUTF8: "1",
    HF_HUB_OFFLINE: "1",
    TRANSFORMERS_OFFLINE: "1",
    HF_DATASETS_OFFLINE: "1",
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: "True",
    CUDA_VISIBLE_DEVICES: "",
    TOOLBOX_DESKTOP_MANAGED: "0"
  };
}

export function runWorkerSuite({ repoRoot, python, suite, vendor, spawn = spawnSync }) {
  if (!path.isAbsolute(python)) throw new Error("--python must name an existing interpreter by absolute path");
  const files = Object.hasOwn(workerSuites, suite) ? workerSuites[suite] : null;
  if (!files) throw new Error("--suite must be image or chatterbox");
  if (vendor && (suite !== "chatterbox" || !path.isAbsolute(vendor) || !statSync(vendor).isDirectory()))
    throw new Error("--vendor requires an explicit existing absolute Chatterbox vendor directory");
  const version = spawn(python, ["-I", "-c", "import sys; print('.'.join(map(str, sys.version_info[:2])))"], {
    encoding: "utf8",
    timeout: 30000
  });
  if (version.error) throw version.error;
  if (version.status !== 0 || version.stdout.trim() !== "3.12")
    throw new Error("Worker contract tests require an existing Python 3.12 environment; nothing was installed");

  const tempParent = realpathSync(os.tmpdir());
  const root = mkdtempSync(path.join(tempParent, "toolbox-worker-contracts-"));
  const scripts = path.join(root, "scripts");
  try {
    mkdirSync(scripts);
    mkdirSync(path.join(root, "temp"));
    for (const file of files) copyFileSync(path.join(repoRoot, "scripts", file), path.join(scripts, file));
    // ROOT is now the temporary copy, including the Worker's legacy trusted paths.
    // Network is disabled before importing third-party model frameworks or test modules.
    const bootstrap = `import runpy, socket, sys, threading
native_connect = socket.socket.connect
native_socketpair = socket.socketpair
socketpair_context = threading.local()
def deny_network(*args, **kwargs):
    raise RuntimeError("Network disabled in Worker contract tests")
def guarded_connect(self, address):
    if getattr(socketpair_context, "active", False):
        return native_connect(self, address)
    return deny_network()
def internal_socketpair(*args, **kwargs):
    previous = getattr(socketpair_context, "active", False)
    socketpair_context.active = True
    try:
        return native_socketpair(*args, **kwargs)
    finally:
        socketpair_context.active = previous
socket.socket.connect = guarded_connect
socket.socketpair = internal_socketpair
socket.socket.connect_ex = deny_network
socket.create_connection = deny_network
# Exercise both sides of the guard before loading any Worker or model framework.
left, right = socket.socketpair()
try:
    left.sendall(b"test")
    assert right.recv(4) == b"test"
finally:
    left.close()
    right.close()
with socket.socket() as probe:
    try:
        probe.connect(("203.0.113.1", 9))
    except RuntimeError as error:
        assert str(error) == "Network disabled in Worker contract tests"
    else:
        raise AssertionError("External connections must remain blocked")
test = sys.argv[1]
vendor = ${JSON.stringify(vendor ?? "")}
if vendor:
    sys.path.insert(0, vendor)
sys.path.insert(0, ${JSON.stringify(scripts)})
sys.argv = [test]
runpy.run_path(test, run_name="__main__")
`;
    const result = spawn(python, ["-I", "-B", "-c", bootstrap, path.join(scripts, files[1])], {
      cwd: root,
      env: isolatedEnvironment(root),
      stdio: "inherit",
      timeout: 300000
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(
        `Worker ${suite} contracts failed (exit ${result.status}, signal ${result.signal ?? "none"}); inspect the test error above. No dependencies were installed.`
      );
  } finally {
    cleanupTemporaryRoot(root, tempParent);
  }
}

function cleanupTemporaryRoot(root, tempParent) {
  const resolved = realpathSync(root);
  if (path.dirname(resolved) !== tempParent || !path.basename(resolved).startsWith("toolbox-worker-contracts-"))
    throw new Error("Refusing cleanup outside the allocated Worker test directory");
  rmSync(resolved, { recursive: true, force: true });
}
