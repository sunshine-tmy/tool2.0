import { spawn } from "node:child_process";

const environment = {
  ...process.env,
  DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE || "local",
  API_HOST: process.env.API_HOST || "127.0.0.1"
};
const children = [spawnPnpm(["--filter", "backend", "start"]), spawnPnpm(["--filter", "frontend", "preview"])];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) terminateChild(child);
  setTimeout(() => process.exit(exitCode), 2_000).unref();
}

function spawnPnpm(args) {
  const options = { env: environment, stdio: "inherit" };
  return process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "pnpm.cmd", ...args], options)
    : spawn("pnpm", args, options);
}

function terminateChild(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform !== "win32") {
    child.kill("SIGTERM");
    return;
  }
  spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
    stdio: "ignore",
    windowsHide: true
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of children) {
  child.once("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}

console.log("Toolbox UI: http://127.0.0.1:4173");
