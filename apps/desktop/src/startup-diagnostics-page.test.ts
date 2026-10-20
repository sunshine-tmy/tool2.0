/** 在隔离脚本环境验证内嵌 JS 和更新行为，不打开或操作真实浏览器。 */
import { Script, createContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startupDiagnosticsPage } from "./startup-diagnostics-page";
import { StartupProgress, type StartupSnapshot } from "./startup-progress";

class Element {
  textContent = "";
  hidden = false;
  disabled = false;
  value = 0;
  max = 0;
  attributes = new Map<string, string>();
  onclick?: () => Promise<void>;
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
}
function page(bridge?: Record<string, unknown>, snapshot = new StartupProgress().snapshot()) {
  const html = startupDiagnosticsPage(snapshot, "nonce123");
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], new Element()]));
  const events = new Map<string, () => void>();
  const script = new Script(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)![1]);
  script.runInContext(
    createContext({
      window: {
        toolboxDesktop: bridge,
        addEventListener: (name: string, callback: () => void) => events.set(name, callback)
      },
      document: {
        getElementById: (id: string) => {
          const element = elements.get(id);
          if (!element) throw new Error(`Missing element: ${id}`);
          return element;
        }
      },
      performance: { now: () => Date.now() },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval
    })
  );
  return { html, get: (id: string) => elements.get(id)!, dispose: () => events.get("beforeunload")?.() };
}
async function settle() {
  for (let n = 0; n < 6; n++) await Promise.resolve();
}
afterEach(() => vi.useRealTimers());

describe("live startup diagnostics page", () => {
  it("renders useful content even if the preload bridge is missing instead of silently going blank", async () => {
    vi.useFakeTimers();
    const view = page();
    await settle();
    expect(view.get("result").textContent).toContain("正在准备");
    expect(view.get("connection").textContent).toContain("状态同步暂时中断");
    expect(view.get("retry").disabled).toBe(true);
    await view.get("copy").onclick!();
    expect(view.get("error").textContent).toContain("操作未完成");
    view.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("updates from real phase pushes, counts actual steps, and ignores late snapshots", async () => {
    vi.useFakeTimers();
    const progress = new StartupProgress();
    const initial = progress.snapshot();
    let push!: (state: StartupSnapshot) => void;
    let resolve!: (state: StartupSnapshot) => void;
    const unsubscribe = vi.fn();
    const view = page(
      {
        getStartupDiagnostics: () =>
          new Promise<StartupSnapshot>((done) => {
            resolve = done;
          }),
        onStartupDiagnostics: (callback: typeof push) => {
          push = callback;
          return unsubscribe;
        }
      },
      initial
    );
    progress.stage("migration");
    push(progress.snapshot());
    expect(view.get("phase").textContent).toBe("检查数据迁移");
    expect(view.get("count").textContent).toBe("已完成 1 / 9 个启动步骤");
    expect(view.get("step-migration").attributes.get("aria-current")).toBe("step");
    resolve(initial);
    await settle();
    expect(view.get("phase").textContent).toBe("检查数据迁移");
    view.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("keeps the clock moving while progress waits, then freezes it on failure", async () => {
    vi.useFakeTimers();
    const progress = new StartupProgress();
    let push!: (state: StartupSnapshot) => void;
    const view = page({
      getStartupDiagnostics: async () => progress.snapshot(),
      onStartupDiagnostics: (callback: typeof push) => {
        push = callback;
      }
    });
    await vi.advanceTimersByTimeAsync(16_000);
    expect(view.get("elapsed").textContent).toBe("16 秒");
    expect(view.get("count").textContent).toBe("已完成 0 / 9 个启动步骤");
    expect(view.get("long-wait").hidden).toBe(false);
    progress.fail("FAILED", "启动失败", true);
    push(progress.snapshot());
    await vi.advanceTimersByTimeAsync(5000);
    expect(view.get("elapsed").textContent).toBe("16 秒");
    expect(view.get("activity").hidden).toBe(true);
    expect(view.get("retry").disabled).toBe(false);
    view.dispose();
  });

  it("flags a hung status request without overlapping polls or pretending the backend is alive", async () => {
    vi.useFakeTimers();
    const get = vi.fn(() => new Promise(() => undefined));
    const view = page({ getStartupDiagnostics: get });
    await vi.advanceTimersByTimeAsync(4000);
    expect(get).toHaveBeenCalledTimes(1);
    expect(view.get("connection").textContent).toContain("不代表后台仍在运行");
    expect(view.get("elapsed").textContent).toBe("4 秒");
    view.dispose();
  });

  it("retains nonce restrictions and safely embeds multiline and closing-script text", () => {
    vi.useFakeTimers();
    const state = new StartupProgress().snapshot();
    state.message = '第一行\n</script><script>bad()</script> "第二行" $& $\'';
    const view = page(undefined, state);
    expect(view.get("result").textContent).toBe(state.message);
    expect((view.html.match(/<script /g) ?? []).length).toBe(1);
    expect(view.html).toContain("default-src 'none'");
    expect(() => startupDiagnosticsPage(state, 'bad"nonce')).toThrow();
    view.dispose();
  });
});
