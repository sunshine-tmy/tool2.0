import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateAdmin, restoreAdminSession, signOutAdmin } from "./admin-session";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  setToken: vi.fn()
}));

vi.mock("./http", () => ({
  httpClient: { get: mocks.get, post: mocks.post, delete: mocks.delete },
  setAdminCsrfToken: mocks.setToken,
  withApiError: (operation: () => Promise<unknown>) => operation()
}));

describe("administrator session client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a fresh or restored CSRF token in memory", async () => {
    mocks.post.mockResolvedValue({ csrfToken: "login-token", expiresInSeconds: 3600 });
    mocks.get.mockResolvedValue({ csrfToken: "restored-token", expiresInSeconds: 1800 });

    await authenticateAdmin("246810");
    await restoreAdminSession();

    expect(mocks.post).toHaveBeenCalledWith("/session", { pin: "246810" });
    expect(mocks.setToken).toHaveBeenNthCalledWith(1, "login-token");
    expect(mocks.setToken).toHaveBeenNthCalledWith(2, "restored-token");
  });

  it("clears the CSRF token after sign-out", async () => {
    mocks.delete.mockResolvedValue(null);
    await signOutAdmin();
    expect(mocks.delete).toHaveBeenCalledWith("/session");
    expect(mocks.setToken).toHaveBeenCalledWith(undefined);
  });
});
