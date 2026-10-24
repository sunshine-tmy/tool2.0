import type { StartupSnapshot } from "@toolbox/shared/desktop";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!
  );
}

export function startupDiagnosticsPage(snapshot: StartupSnapshot, nonce: string) {
  if (!/^[A-Za-z0-9]+$/.test(nonce)) throw new Error("无效的启动页 nonce");
  const initial = JSON.stringify(snapshot).replace(/</g, "\\u003c");
  // raw 保留脚本中的转义，不让宿主模板把 \n 变成字符串字面量里的真实换行。
  const script = String.raw`
const api = window.toolboxDesktop;
const byId = (id) => document.getElementById(id);
let state = INITIAL_STATE;
let receivedAt = performance.now();
let connected = null;
let contactRevision = 0;
let polling = false;
let disposed = false;
const busy = new Set();
const seconds = (value) => Math.floor(Math.max(0, value) / 1000) + ' 秒';
function render() {
  const extra = state.failed || state.entered ? 0 : performance.now() - receivedAt;
  byId('phase').textContent = state.phase;
  byId('result').textContent = state.message;
  byId('elapsed').textContent = seconds(state.elapsedMs + extra);
  byId('stage-elapsed').textContent = seconds(state.stageElapsedMs + extra);
  byId('count').textContent = '已完成 ' + state.completedCount + ' / ' + state.totalSteps + ' 个启动步骤';
  byId('progress').max = state.totalSteps;
  byId('progress').value = state.completedCount;
  byId('activity').hidden = state.failed || state.entered;
  byId('running').textContent = state.failed ? '需要处理启动问题' : state.entered ? '基础服务已就绪' : '正在启动，请稍候';
  byId('code').textContent = state.failed ? '原因码：' + state.code : '进度仅随真实阶段变化，不代表剩余时间。';
  byId('long-wait').hidden = state.failed || state.entered || state.stageElapsedMs + extra < 15000;
  const stale = connected === true && performance.now() - receivedAt > 5000;
  byId('connection').textContent = connected === null ? '正在连接启动状态…' : connected && !stale ? '已连接启动状态' : '状态同步暂时中断；当前仅显示上次结果和等待时长，不代表后台仍在运行。';
  for (const step of state.steps) {
    const item = byId('step-' + step.id);
    item.setAttribute('data-state', step.status);
    if (step.status === 'active') item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    byId('status-' + step.id).textContent = ({ pending: '未开始', active: '进行中', completed: '已完成', failed: '失败' })[step.status];
  }
  byId('retry').disabled = !state.failed || !state.canRetry || busy.has('retry');
}
function receive(value) {
  if (!value || !Array.isArray(value.steps) || typeof value.elapsedMs !== 'number') return;
  if (value.revision < state.revision || (value.revision === state.revision && value.elapsedMs < state.elapsedMs)) return;
  state = value;
  receivedAt = performance.now();
  connected = true;
  contactRevision++;
  render();
}
async function refresh() {
  if (disposed || polling) return;
  polling = true;
  const revision = contactRevision;
  const timeout = setTimeout(() => { if (contactRevision === revision) { connected = false; render(); } }, 2500);
  try {
    if (!api || typeof api.getStartupDiagnostics !== 'function') throw new Error('bridge unavailable');
    receive(await api.getStartupDiagnostics());
  } catch { if (contactRevision === revision) { connected = false; render(); } }
  finally { clearTimeout(timeout); polling = false; }
}
let unsubscribe;
try { unsubscribe = api && api.onStartupDiagnostics && api.onStartupDiagnostics(receive); } catch { connected = false; }
for (const [id, method] of [['retry', 'retryStartup'], ['copy', 'copyStartupDiagnostics'], ['export', 'exportStartupDiagnostics'], ['logs', 'revealStartupLogs'], ['exit', 'exitStartupDiagnostics']]) {
  byId(id).onclick = async () => {
    if (busy.has(id) || byId(id).disabled) return;
    busy.add(id);
    byId(id).disabled = true;
    byId('error').textContent = '';
    try {
      if (!api || typeof api[method] !== 'function') throw new Error('bridge unavailable');
      await api[method]();
    } catch { byId('error').textContent = '操作未完成。请检查启动状态；报告无法保存时可尝试复制摘要。'; }
    finally { busy.delete(id); if (id !== 'retry') byId(id).disabled = false; render(); void refresh(); }
  };
}
render();
void refresh();
const pollTimer = setInterval(refresh, 1000);
const clockTimer = setInterval(render, 250);
window.addEventListener('beforeunload', () => { disposed = true; clearInterval(pollTimer); clearInterval(clockTimer); if (typeof unsubscribe === 'function') unsubscribe(); });
`.replace("INITIAL_STATE", () => initial);

  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'"><title>启动与环境诊断</title>
<style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;background:#f6f8fc;color:#172033;font:14px/1.7 'Microsoft YaHei',system-ui,sans-serif;padding:32px}main{max-width:800px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:28px}h1{font-size:22px;margin:0 0 10px}p{margin:8px 0;color:#64748b}.status-line{display:flex;align-items:center;gap:10px;margin:22px 0 12px;color:#2563eb;font-weight:600}.dot{width:8px;height:8px;border-radius:50%;background:#2563eb}.phase-line,.metrics{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.metrics{font-size:13px;color:#64748b;margin:8px 0}#phase{font-size:16px}#count{color:#2563eb}progress{display:block;width:100%;height:8px;border:0;border-radius:8px;overflow:hidden;background:#e8eef8;accent-color:#2563eb}progress::-webkit-progress-bar{background:#e8eef8}progress::-webkit-progress-value{background:#2563eb;border-radius:8px}.activity{height:3px;background:#eff6ff;overflow:hidden;margin-top:8px;border-radius:3px}.activity:after{content:'';display:block;width:30%;height:100%;background:#60a5fa;animation:waiting 1.5s ease-in-out infinite}@keyframes waiting{from{transform:translateX(-100%)}to{transform:translateX(440%)}}[hidden]{display:none!important}@media(prefers-reduced-motion:reduce){.activity:after{animation:none}}.steps{list-style:none;padding:0;margin:18px 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.steps li{border:1px solid #e8edf5;background:#f8fafc;border-radius:8px;padding:9px 10px;min-width:0}.steps strong,.steps small{display:block}.steps strong{font-size:12px;font-weight:500}.steps small{font-size:11px;color:#94a3b8}.steps [data-state=active]{border-color:#93b4ff;background:#eff6ff;color:#2563eb}.steps [data-state=completed] small{color:#0f766e}.steps [data-state=failed]{border-color:#fecaca;color:#dc2626}#result{padding:14px;background:#f8fafc;border-radius:8px;min-height:50px;white-space:pre-wrap}#code,#connection,#long-wait{font-size:12px}#long-wait{padding:10px 12px;background:#fffbeb;color:#92400e;border-radius:8px}nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}button{font:inherit;background:white;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;cursor:pointer}#retry{background:#2563eb;color:white;border-color:#2563eb}button:disabled{opacity:.45;cursor:not-allowed}#error{color:#dc2626;min-height:20px;font-size:12px}@media(max-width:640px){body{padding:16px}main{padding:20px}.steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
details{margin:14px 0}summary{cursor:pointer;color:#64748b;font-size:13px}#error:empty{display:none}
</style></head><body><main><h1>启动与环境诊断</h1><p>正在启动本地应用。可选模型在基础服务就绪后继续准备，不阻塞进入主界面。</p>
<div class="status-line"><span class="dot" aria-hidden="true"></span><span id="running">正在启动，请稍候</span></div>
<div class="phase-line"><strong id="phase">${escapeHtml(snapshot.phase)}</strong><span id="count">已完成 ${snapshot.completedCount} / ${snapshot.totalSteps} 个启动步骤</span></div>
<div class="metrics"><span>总等待：<span id="elapsed">${Math.floor(snapshot.elapsedMs / 1000)} 秒</span></span><span>当前阶段：<span id="stage-elapsed">${Math.floor(snapshot.stageElapsedMs / 1000)} 秒</span></span></div>
<progress id="progress" aria-label="已完成启动步骤" max="${snapshot.totalSteps}" value="${snapshot.completedCount}"></progress><div id="activity" class="activity" aria-label="等待当前阶段完成"></div>
<details><summary>查看启动步骤</summary><ol class="steps">${snapshot.steps.map((step) => `<li id="step-${step.id}" data-state="${step.status}"><strong>${escapeHtml(step.label)}</strong><small id="status-${step.id}">${{ pending: "未开始", active: "进行中", completed: "已完成", failed: "失败" }[step.status]}</small></li>`).join("")}</ol></details>
<div id="result" role="status" aria-live="polite">${escapeHtml(snapshot.message)}</div><p id="code">进度仅随真实阶段变化，不代表剩余时间。</p><p id="long-wait" hidden>当前阶段等待较久，尚未收到下一阶段结果。可以继续等待，或查看日志；不会用计时伪造进度。</p><p id="connection">正在连接启动状态；若长时间无法同步，请查看日志。</p>
<nav><button id="retry" disabled>重新尝试启动</button><button id="copy">复制摘要</button><button id="export">导出报告</button><button id="logs">打开日志目录</button><button id="exit">退出应用</button></nav><p id="error" role="alert"></p></main><script nonce="${nonce}">${script}</script></body></html>`;
}
