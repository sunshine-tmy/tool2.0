/** Mac source launcher and explicit, digest-checked offline component preparation. */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectMacOfflineResources,
  macArchiveInventory,
  parseMacCatalogSource,
  prepareMacOfflineResources
} from "./macos-offline-resources.mjs";

export const macProjectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogFile = path.join(macProjectRoot, "apps/api/src/modules/components/catalog.darwin-arm64.generated.ts");
const stateDirectory = path.join(macProjectRoot, ".runtime/macos-source-launcher");
const stateFile = path.join(stateDirectory, "session.json");
const lockFile = path.join(stateDirectory, "launcher.lock");
const resourceDirectory = path.join(macProjectRoot, "offline-resources/components");

export function assertMacProjectRuntime({
  platform = process.platform,
  arch = process.arch,
  nodeVersion = process.versions.node
} = {}) {
  if (platform !== "darwin" || arch !== "arm64")
    throw new Error(`此入口需要 Apple Silicon macOS；当前环境为 ${platform}-${arch}`);
  const major = Number(nodeVersion.split(".")[0]);
  if (major !== 24)
    throw new Error(`需要 Node.js 24（当前 ${nodeVersion}）。请安装 Node.js 24 后重新打开终端或 Finder。`);
}

export async function assertElectronRuntimeInstalled({ root = macProjectRoot, access = fs.access } = {}) {
  const electronBinary = path.join(
    root,
    "apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
  );
  try {
    await access(electronBinary);
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    throw new Error(
      "未找到 Electron 桌面运行时。为避免启动时隐式联网，请先在项目根目录显式运行 node apps/desktop/node_modules/electron/install.js，再重试 start.command。"
    );
  }
  return electronBinary;
}

export function parseProcessSnapshot({ processId, groupId, startedAt, command }) {
  const parsedPid = Number(String(processId).trim());
  const parsedGroup = Number(String(groupId).trim());
  const start = String(startedAt).trim();
  const cmd = String(command).trim();
  if (
    !Number.isSafeInteger(parsedPid) ||
    parsedPid < 2 ||
    !Number.isSafeInteger(parsedGroup) ||
    parsedGroup < 2 ||
    !start ||
    !cmd
  )
    return undefined;
  return { pid: parsedPid, groupId: parsedGroup, startedAt: start, command: cmd };
}

export function sessionCommandSha256(command) {
  return createHash("sha256").update(command).digest("hex");
}

export function hasElectronProcessInGroup(processList, groupId) {
  const expectedGroup = Number(groupId);
  return processList.split(/\r?\n/).some((line) => {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    return (
      match && Number(match[1]) === expectedGroup && /\/Electron\.app\/Contents\/MacOS\/Electron(?:\s|$)/.test(match[2])
    );
  });
}

export async function prepareMacResources({ root = resourceDirectory, fetchImpl = fetch, report = console.log } = {}) {
  assertMacProjectRuntime();
  const catalog = await readMacCatalog();
  const inventory = macArchiveInventory(catalog);
  report(
    `签名目录声明 ${inventory.length} 个 Mac 归档，共 ${(inventory.reduce((sum, item) => sum + item.bytes, 0) / 1e9).toFixed(2)} GB。`
  );
  for (const archive of inventory) report(`- ${archive.filename} (${archive.bytes} 字节)`);
  const completed = await prepareMacOfflineResources(catalog, root, { fetchImpl, report });
  report(`完成：${completed.length} 个归档已通过字节数和 SHA-256 校验，位置：${root}`);
  return completed;
}

export async function inspectMacResources({ root = resourceDirectory, report = console.log } = {}) {
  assertMacProjectRuntime();
  const inventory = await inspectMacOfflineResources(await readMacCatalog(), root);
  report(`签名目录：${inventory.archives.length} 个归档，总计 ${(inventory.totalBytes / 1e9).toFixed(2)} GB`);
  if (inventory.missing.length) {
    report("缺少的归档：");
    for (const archive of inventory.missing) report(`- ${archive.filename} (${archive.bytes} 字节)`);
  }
  if (inventory.invalid.length) {
    report("摘要或文件类型不匹配的归档：");
    for (const archive of inventory.invalid) report(`- ${archive.filename}: ${archive.detail}`);
  }
  if (inventory.missing.length || inventory.invalid.length)
    throw new Error(
      "离线能力包未齐全。确认 Release 资产可访问后，显式运行 corepack pnpm macos:prepare-resources；启动本身不会下载这些大文件。"
    );
  report(`离线资源齐全并通过 SHA-256 校验：${root}`);
  return inventory;
}

export async function startMacProject({
  root = macProjectRoot,
  env = process.env,
  runForeground = runChecked,
  launch = spawn
} = {}) {
  assertMacProjectRuntime();
  root = await fs.realpath(root);
  await assertElectronRuntimeInstalled({ root });
  await fs.access(path.join(root, "node_modules"));
  await fs.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  const lock = await acquireLauncherLock();
  try {
    const existing = await readSession();
    if (existing) {
      const status = readSessionProcess(existing);
      if (status === "running") {
        console.log(
          `电商工具箱已由此项目启动（PID ${existing.pid}）。日志：${path.join(stateDirectory, "desktop.log")}`
        );
        return existing.pid;
      }
      if (status === "identity-mismatch")
        throw new Error(
          "启动记录中的 PID 身份与当前进程不符。为避免停止无关进程，已保留记录；请检查 .runtime/macos-source-launcher/session.json。"
        );
      await fs.rm(stateFile, { force: true });
    }

    const selectedPackageManager = await resolvePackageManager(env, root);
    const packageManager = await ensureNestedPnpmCommand(selectedPackageManager);

    console.log("[1/4] 构建共享契约（不会安装依赖或下载能力包）");
    await runForeground(packageManager.command, [...packageManager.prefix, "build:shared"], {
      cwd: root,
      env: packageManager.env
    });
    console.log("[2/4] 预检并复用本机签名能力；缺失资源将一次列出，且不会自动联网下载");
    await runBootstrap(root, env);
    console.log("[3/4] 构建本机桌面源码");
    await runForeground(packageManager.command, [...packageManager.prefix, "desktop:build"], {
      cwd: root,
      env: packageManager.env
    });
    console.log("[4/4] 启动桌面应用");

    const logPath = path.join(stateDirectory, "desktop.log");
    const logFd = await fs.open(logPath, "a", 0o600);
    let child;
    try {
      child = launch(packageManager.command, [...packageManager.prefix, "--filter", "desktop", "start"], {
        cwd: root,
        env: packageManager.env,
        detached: true,
        stdio: ["ignore", logFd.fd, logFd.fd]
      });
    } finally {
      await logFd.close();
    }
    if (!child?.pid) throw new Error("无法创建本项目独立进程组");
    const processInfo = await waitForLeader(child.pid, 5000);
    if (!processInfo || processInfo.groupId !== child.pid || !isDesktopStartCommand(processInfo.command)) {
      await stopStartedProcessGroup(child.pid);
      throw new Error("桌面启动进程身份检查失败，未写入停止记录。请查看本地启动器日志。");
    }
    if (!(await waitForElectronProcessInGroup(child.pid, 15000))) {
      await stopStartedProcessGroup(child.pid);
      throw new Error("Electron 没有在 15 秒内进入本项目进程组；启动未完成，请检查本地桌面日志。");
    }
    const session = {
      schemaVersion: 1,
      projectRoot: root,
      pid: processInfo.pid,
      groupId: processInfo.groupId,
      startedAt: processInfo.startedAt,
      commandSha256: sessionCommandSha256(processInfo.command),
      logPath,
      createdAt: new Date().toISOString()
    };
    await writeSession(session);
    child.unref();
    console.log(
      `桌面应用已启动（PID ${session.pid}）。关闭当前终端不会停止应用；停止时运行 stop.command。日志：${logPath}`
    );
    return session.pid;
  } finally {
    await lock.close();
    await fs.rm(lockFile, { force: true });
  }
}

export async function stopMacProject({ root = macProjectRoot, waitMs = 15000, run = spawnSync } = {}) {
  assertMacProjectRuntime();
  root = await fs.realpath(root);
  await fs.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  const lock = await acquireLauncherLock();
  try {
    const session = await readSession();
    if (!session) {
      console.log("没有本项目的启动记录；未按端口或进程名称查找/终止其他程序。");
      return false;
    }
    if (session.projectRoot !== root) throw new Error("启动记录属于另一个项目路径，拒绝停止。");
    const snapshot = readProcessSnapshot(session.pid, run);
    if (!snapshot) {
      await fs.rm(stateFile, { force: true });
      console.log("记录中的启动进程已退出；已清理过期记录，没有终止其他进程。");
      return false;
    }
    if (
      snapshot.groupId !== session.groupId ||
      session.groupId !== session.pid ||
      !sameProcessStartTime(snapshot.startedAt, session.startedAt) ||
      sessionCommandSha256(snapshot.command) !== session.commandSha256 ||
      !isDesktopStartCommand(snapshot.command)
    )
      throw new Error("启动记录中的 PID/进程组身份与当前进程不符。为避免影响无关程序，没有发送信号。");

    signalProcessGroup(session.groupId, "SIGTERM");
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline && processGroupExists(session.groupId)) await delay(250);
    if (processGroupExists(session.groupId)) {
      console.log("正常关闭等待超时；将强制结束本启动器创建并记录的独立进程组。");
      signalProcessGroup(session.groupId, "SIGKILL");
      const killDeadline = Date.now() + 5000;
      while (Date.now() < killDeadline && processGroupExists(session.groupId)) await delay(200);
    }
    if (processGroupExists(session.groupId)) throw new Error("本项目进程组仍存在；启动记录保留，未再扩大终止范围。");
    await fs.rm(stateFile, { force: true });
    console.log("本项目桌面进程已停止。");
    return true;
  } finally {
    await lock.close();
    await fs.rm(lockFile, { force: true });
  }
}

async function readMacCatalog() {
  return parseMacCatalogSource(await fs.readFile(catalogFile, "utf8"));
}

export async function resolvePackageManager(env = process.env, root = macProjectRoot, run = spawnSync) {
  const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  const expected = packageJson.packageManager?.match(/^pnpm@(.+)$/)?.[1];
  const candidates = [
    { command: "pnpm", prefix: [], env },
    { command: "corepack", prefix: ["pnpm"], env: { ...env, COREPACK_ENABLE_NETWORK: "0" } }
  ];
  const versions = [];
  for (const candidate of candidates) {
    const result = run(candidate.command, [...candidate.prefix, "--version"], {
      cwd: root,
      env: candidate.env,
      encoding: "utf8"
    });
    const actual = result.status === 0 ? result.stdout.trim() : "";
    if (actual) versions.push(actual);
    if (expected && actual === expected) return candidate;
  }
  throw new Error(
    `需要 pnpm ${expected || "11.7.0"}。当前版本：${versions.join(", ") || "未找到"}。可先安装固定版本，再从已配置 PATH 的终端或 Finder 重新打开 start.command。`
  );
}

/** Corepack does not install a `pnpm` shim on Finder's PATH; package scripts still call `pnpm` recursively. */
export async function ensureNestedPnpmCommand(packageManager, { directory = stateDirectory } = {}) {
  if (packageManager.command !== "corepack") return packageManager;

  const shimDirectory = path.join(directory, "bin");
  const shimPath = path.join(shimDirectory, "pnpm");
  const shimContents = '#!/bin/sh\nexec corepack pnpm "$@"\n';
  await fs.mkdir(shimDirectory, { recursive: true, mode: 0o700 });
  try {
    const info = await fs.lstat(shimPath);
    if (!info.isFile() || info.isSymbolicLink() || (await fs.readFile(shimPath, "utf8")) !== shimContents)
      throw new Error("Corepack pnpm shim 已存在但内容不匹配；为避免覆盖其他文件，启动已停止。");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await fs.writeFile(shimPath, shimContents, { encoding: "utf8", flag: "wx", mode: 0o700 });
  }
  await fs.chmod(shimPath, 0o700);

  const pathEntries = [shimDirectory, packageManager.env.PATH].filter(Boolean);
  return {
    ...packageManager,
    env: { ...packageManager.env, PATH: pathEntries.join(path.delimiter) }
  };
}

async function runBootstrap(root, env) {
  const cli = path.join(root, "apps/api/node_modules/tsx/dist/cli.mjs");
  try {
    await fs.access(cli);
  } catch {
    throw new Error("未找到后端 tsx；请在项目根目录运行 pnpm install --frozen-lockfile，然后重试。不会隐式安装依赖。");
  }
  await runChecked(
    process.execPath,
    [cli, "--tsconfig", path.join(root, "apps/api/tsconfig.json"), path.join(root, "scripts/bootstrap-components.ts")],
    {
      cwd: root,
      env: { ...env, TOOLBOX_SOURCE_MANAGED: "1" }
    }
  );
}

async function acquireLauncherLock() {
  await fs.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  try {
    return await fs.open(lockFile, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("另一个本项目启动/停止操作正在进行；请稍后重试。");
    throw error;
  }
}

async function readSession() {
  try {
    const value = JSON.parse(await fs.readFile(stateFile, "utf8"));
    if (
      value?.schemaVersion !== 1 ||
      !Number.isSafeInteger(value.pid) ||
      !Number.isSafeInteger(value.groupId) ||
      typeof value.projectRoot !== "string" ||
      typeof value.startedAt !== "string" ||
      typeof value.commandSha256 !== "string"
    )
      throw new Error("启动记录格式无效，未执行进程操作。");
    return value;
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function readSessionProcess(session) {
  const snapshot = readProcessSnapshot(session.pid, spawnSync);
  if (!snapshot) return "stopped";
  return snapshot.groupId === session.groupId &&
    sameProcessStartTime(snapshot.startedAt, session.startedAt) &&
    sessionCommandSha256(snapshot.command) === session.commandSha256 &&
    isDesktopStartCommand(snapshot.command)
    ? "running"
    : "identity-mismatch";
}

function readProcessSnapshot(pid, run) {
  const readField = (field) => {
    const result = run("ps", ["-p", String(pid), "-o", `${field}=`], {
      encoding: "utf8",
      env: { ...process.env, LC_ALL: "C" }
    });
    return result.status === 0 ? result.stdout.trim() : "";
  };
  return parseProcessSnapshot({
    processId: pid,
    groupId: readField("pgid"),
    startedAt: readField("lstart"),
    command: readField("command")
  });
}

function sameProcessStartTime(left, right) {
  const leftTime = normalizeProcessStartTime(left);
  return leftTime !== undefined && leftTime === normalizeProcessStartTime(right);
}

export function normalizeProcessStartTime(value) {
  const raw = String(value).trim();
  const localized = raw.match(/^(?:星期|周)?([一二三四五六日天])\s+(\d{1,2})\/(\d{1,2}) (\d{2}:\d{2}:\d{2}) (\d{4})$/);
  if (!localized) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) * 1000 : undefined;
  }

  const [, weekday, monthText, dayText, timeText, yearText] = localized;
  const [hour, minute, second] = timeText.split(":").map(Number);
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText), hour, minute, second);
  const expectedWeekday = weekday === "日" || weekday === "天" ? 0 : "一二三四五六".indexOf(weekday) + 1;
  if (
    date.getFullYear() !== Number(yearText) ||
    date.getMonth() !== Number(monthText) - 1 ||
    date.getDate() !== Number(dayText) ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second ||
    date.getDay() !== expectedWeekday
  )
    return undefined;
  return Math.floor(date.getTime() / 1000) * 1000;
}

async function waitForLeader(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  do {
    const snapshot = readProcessSnapshot(pid, spawnSync);
    if (snapshot) return snapshot;
    await delay(100);
  } while (Date.now() < deadline);
  return undefined;
}

async function waitForElectronProcessInGroup(groupId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  do {
    if (!readProcessSnapshot(groupId, spawnSync)) return false;
    const result = spawnSync("ps", ["-ax", "-o", "pgid=,command="], { encoding: "utf8" });
    if (result.status === 0 && hasElectronProcessInGroup(result.stdout, groupId)) return true;
    await delay(150);
  } while (Date.now() < deadline);
  return false;
}

async function stopStartedProcessGroup(groupId) {
  signalProcessGroup(groupId, "SIGTERM");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && processGroupExists(groupId)) await delay(150);
  if (processGroupExists(groupId)) signalProcessGroup(groupId, "SIGKILL");
}

function isDesktopStartCommand(command) {
  return /pnpm(?:\.c?js)?/i.test(command) && /--filter\s+desktop\s+start/.test(command);
}

async function writeSession(session) {
  const temporary = `${stateFile}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await fs.rename(temporary, stateFile);
}

function signalProcessGroup(groupId, signal) {
  try {
    process.kill(-groupId, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function processGroupExists(groupId) {
  try {
    process.kill(-groupId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

function runChecked(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} ${args.join(" ")} 退出，状态码 ${code ?? "unknown"}`));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(args) {
  const [command, ...extra] = args;
  if (extra.length) throw new Error("只接受 start、stop、resources-status 或 prepare-resources");
  if (command === "start") await startMacProject();
  else if (command === "stop") await stopMacProject();
  else if (command === "resources-status") await inspectMacResources();
  else if (command === "prepare-resources") await prepareMacResources();
  else {
    console.log("用法：node scripts/macos-project.mjs <start|stop|resources-status|prepare-resources>");
    if (command) throw new Error(`未知命令：${command}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : "Mac 项目入口失败");
    process.exitCode = 1;
  });
}
