import { spawn } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const environment = {
  ...process.env,
  DEPLOYMENT_MODE: process.env.DEPLOYMENT_MODE || "local",
  API_HOST: process.env.API_HOST || "127.0.0.1"
};
const children = [
  spawn(pnpm, ["--filter", "backend", "start"], { env: environment, stdio: "inherit" }),
  spawn(pnpm, ["--filter", "frontend", "preview"], { env: environment, stdio: "inherit" })
];

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(exitCode), 2_000).unref();
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
