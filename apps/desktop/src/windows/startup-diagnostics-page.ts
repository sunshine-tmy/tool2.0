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
*{box-sizing:border-box}
:root{color-scheme:light;--primary:#6654ff;--ink:#192037;--muted:#778099;--border:#e5e1fb;--soft:#f8f7ff}
body{margin:0;min-height:100vh;padding:32px 24px;background:radial-gradient(ellipse at 15% 0%,#eae7ff 0%,transparent 48%),radial-gradient(ellipse at 100% 100%,#e5f4ff 0%,transparent 42%),#f6f4ff;color:var(--ink);font:14px/1.7 'Microsoft YaHei',system-ui,sans-serif}
main{width:100%;max-width:840px;margin:0 auto;padding:30px 32px 24px;border:1px solid var(--border);border-radius:20px;background:#ffffffed;box-shadow:0 12px 40px #6554ff0b}
.startup-header{display:flex;align-items:center;gap:16px;margin-bottom:22px}
.startup-mark{display:grid;place-items:center;flex:0 0 58px;height:58px;border-radius:16px;background:linear-gradient(145deg,#91dfff,#9c91ff 48%,#6654ff);box-shadow:inset 0 1px 1px #fff9,0 5px 14px #6654ff22;color:white}
.startup-brand{font-size:12px;font-weight:600;color:var(--primary);letter-spacing:.5px}
h1{font-size:24px;line-height:1.4;margin:3px 0 0;letter-spacing:-.5px}
p{margin:8px 0;color:var(--muted)}
.startup-intro{font-size:13px;margin:0 0 20px;line-height:1.8}
.status-line{display:flex;align-items:center;gap:9px;margin:0 0 16px;color:var(--primary);font-size:13px;font-weight:600}
.dot{width:8px;height:8px;border-radius:50%;background:var(--primary);box-shadow:0 0 0 4px #6654ff12}
.phase-line,.metrics{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.metrics{font-size:12px;color:var(--muted);margin:10px 0}
#phase{font-size:16px}#count{padding:3px 9px;border-radius:6px;background:#f0edff;color:var(--primary);font-size:12px}
progress{display:block;width:100%;height:8px;border:0;border-radius:8px;overflow:hidden;background:#eeebfa;accent-color:var(--primary)}
progress::-webkit-progress-bar{background:#eeebfa}progress::-webkit-progress-value{background:linear-gradient(90deg,#9c8aff,var(--primary));border-radius:8px}
.activity{height:2px;background:#f2efff;overflow:hidden;margin-top:6px;border-radius:3px}
.activity:after{content:'';display:block;width:30%;height:100%;background:#b3a7ff;animation:waiting 1.5s ease-in-out infinite}
@keyframes waiting{from{transform:translateX(-100%)}to{transform:translateX(440%)}}
[hidden]{display:none!important}@media(prefers-reduced-motion:reduce){.activity:after{animation:none}}
details{margin:20px 0}summary{cursor:pointer;color:var(--muted);font-size:12px}summary:hover{color:var(--primary)}
.steps{list-style:none;padding:0;margin:12px 0 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.steps li{position:relative;border:1px solid var(--border);background:var(--soft);border-radius:10px;padding:12px;min-width:0}
.steps strong,.steps small{display:block}.steps strong{font-size:12px;font-weight:500}.steps small{margin-top:3px;font-size:11px;color:#9b9fb3}
.steps [data-state=active]{border-color:#a89bff;background:#f0edff;box-shadow:0 0 0 2px #6654ff08;color:var(--primary)}
.steps [data-state=active] strong{font-weight:600}.steps [data-state=active] small{color:var(--primary)}
.steps [data-state=completed] small{color:#26956d}.steps [data-state=completed]:after{content:'✓';position:absolute;right:10px;top:10px;color:#26956d;font-size:12px}
.steps [data-state=failed]{border-color:#f4bdc7;background:#fff5f6;color:#c23c57}.steps [data-state=failed] small{color:#c23c57}
#result{padding:14px 16px;background:var(--soft);border:1px solid var(--border);border-radius:10px;min-height:50px;white-space:pre-wrap;font-size:13px;overflow-wrap:anywhere}
#code,#connection,#long-wait{font-size:11px;line-height:1.7}#code{margin-top:10px}#connection{color:#9b9fb3}
#long-wait{padding:10px 12px;background:#fff9ef;border:1px solid #f4e7cf;color:#967041;border-radius:8px}
nav{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:22px;padding-top:18px;border-top:1px solid var(--border)}
button{font:inherit;font-size:12px;font-weight:500;background:white;color:#686581;border:1px solid var(--border);border-radius:8px;padding:8px 12px;cursor:pointer;transition:background .15s,border-color .15s}
button:hover:not(:disabled){color:var(--primary);background:#f3f0ff;border-color:#c1b8ff}button:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
#retry{background:var(--primary);color:white;border-color:var(--primary);box-shadow:0 3px 9px #6654ff22}#retry:hover:not(:disabled){background:#5745ec}
#exit{margin-left:auto}button:disabled{opacity:.4;cursor:not-allowed;box-shadow:none!important}
#error{color:#c23c57;min-height:20px;font-size:12px}#error:empty{display:none}
@media(max-width:640px){body{padding:16px 12px}main{padding:22px 18px;border-radius:16px}.startup-header{gap:12px}.startup-mark{flex-basis:48px;height:48px;border-radius:13px}h1{font-size:21px}.steps{grid-template-columns:repeat(2,minmax(0,1fr))}#exit{margin-left:0}}
</style></head><body><main><header class="startup-header"><span class="startup-mark" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 32 32" fill="none"><rect x="4" y="10" width="24" height="18" rx="4" fill="white" fill-opacity=".2" stroke="white" stroke-width="2"/><path d="M11 10V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3M4 17h24" stroke="white" stroke-width="2"/><rect x="13" y="15" width="6" height="5" rx="1.5" fill="white"/></svg></span><div><div class="startup-brand">电商工具箱 · 本地工作台</div><h1>启动与环境诊断</h1></div></header><p class="startup-intro">正在启动本地应用。可选模型在基础服务就绪后继续准备，不阻塞进入主界面。</p>
<div class="status-line"><span class="dot" aria-hidden="true"></span><span id="running">正在启动，请稍候</span></div>
<div class="phase-line"><strong id="phase">${escapeHtml(snapshot.phase)}</strong><span id="count">已完成 ${snapshot.completedCount} / ${snapshot.totalSteps} 个启动步骤</span></div>
<div class="metrics"><span>总等待：<span id="elapsed">${Math.floor(snapshot.elapsedMs / 1000)} 秒</span></span><span>当前阶段：<span id="stage-elapsed">${Math.floor(snapshot.stageElapsedMs / 1000)} 秒</span></span></div>
<progress id="progress" aria-label="已完成启动步骤" max="${snapshot.totalSteps}" value="${snapshot.completedCount}"></progress><div id="activity" class="activity" aria-label="等待当前阶段完成"></div>
<details><summary>查看启动步骤</summary><ol class="steps">${snapshot.steps.map((step) => `<li id="step-${step.id}" data-state="${step.status}"><strong>${escapeHtml(step.label)}</strong><small id="status-${step.id}">${{ pending: "未开始", active: "进行中", completed: "已完成", failed: "失败" }[step.status]}</small></li>`).join("")}</ol></details>
<div id="result" role="status" aria-live="polite">${escapeHtml(snapshot.message)}</div><p id="code">进度仅随真实阶段变化，不代表剩余时间。</p><p id="long-wait" hidden>当前阶段等待较久，尚未收到下一阶段结果。可以继续等待，或查看日志；不会用计时伪造进度。</p><p id="connection">正在连接启动状态；若长时间无法同步，请查看日志。</p>
<nav><button id="retry" disabled>重新尝试启动</button><button id="copy">复制摘要</button><button id="export">导出报告</button><button id="logs">打开日志目录</button><button id="exit">退出应用</button></nav><p id="error" role="alert"></p></main><script nonce="${nonce}">${script}</script></body></html>`;
}
