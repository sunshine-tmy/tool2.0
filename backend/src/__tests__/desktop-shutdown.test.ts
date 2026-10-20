import { describe, expect, it } from "vitest";
import { DesktopShutdown } from "../lifecycle/desktop-shutdown";

describe("desktop shutdown admission", () => {
  it("rechecks tasks before committing and blocks all later writes", () => {
    const shutdown = new DesktopShutdown();
    let busy = false;
    shutdown.bind(() => ({ busy, blocked: false }));
    expect(shutdown.inspect().busy).toBe(false);
    busy = true;
    expect(shutdown.prepare(false).prepared).toBe(false);
    expect(shutdown.prepare(true).prepared).toBe(true);
    expect(() => shutdown.enter("late-task")).toThrow("正在退出");
    expect(shutdown.prepare(true).prepared).toBe(true);
  });
  it("does not interrupt in-flight writes, installation or maintenance even with confirmation", () => {
    const shutdown = new DesktopShutdown();
    shutdown.enter("write");
    expect(shutdown.prepare(true)).toMatchObject({ blocked: true, prepared: false });
    shutdown.leave("write");
    shutdown.bind(() => ({ busy: true, blocked: true, reason: "安装中" }));
    expect(shutdown.prepare(true)).toMatchObject({ reason: "安装中", prepared: false });
    expect(shutdown.prepared).toBe(false);
  });
  it("tracks request identity rather than a caller-supplied request ID", () => {
    const shutdown = new DesktopShutdown();
    const first = { id: "repeated-header" };
    const second = { id: "repeated-header" };
    shutdown.enter(first);
    shutdown.enter(second);
    shutdown.leave(first);
    expect(shutdown.prepare(true)).toMatchObject({ blocked: true, prepared: false });
    shutdown.leave(second);
    expect(shutdown.prepare(false).prepared).toBe(true);
  });
});
