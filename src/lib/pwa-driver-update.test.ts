import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkForDriverAppUpdate } from "./pwa-driver-update";

describe("checkForDriverAppUpdate", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    // @ts-expect-error restore
    globalThis.navigator = originalNavigator;
  });

  it("returns 'unsupported' when serviceWorker is missing", async () => {
    // @ts-expect-error minimal stub
    globalThis.navigator = {};
    expect(await checkForDriverAppUpdate()).toBe("unsupported");
  });

  it("returns 'unsupported' when no registration is present", async () => {
    // @ts-expect-error minimal stub
    globalThis.navigator = { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(null) } };
    expect(await checkForDriverAppUpdate()).toBe("unsupported");
  });

  it("returns 'current' when update produces no new worker", async () => {
    const reg = { waiting: null, installing: null, update: vi.fn().mockResolvedValue(undefined) };
    // @ts-expect-error minimal stub
    globalThis.navigator = { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(reg) } };
    expect(await checkForDriverAppUpdate()).toBe("current");
    expect(reg.update).toHaveBeenCalled();
  });

  it("returns 'updated' when a new worker is installed after update", async () => {
    let installing: any = null;
    const reg = {
      get waiting() { return null; },
      get installing() { return installing; },
      update: vi.fn().mockImplementation(async () => {
        installing = { state: "installing" };
      }),
    };
    // @ts-expect-error minimal stub
    globalThis.navigator = { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(reg) } };
    expect(await checkForDriverAppUpdate()).toBe("updated");
  });

  it("returns 'unsupported' on error", async () => {
    // @ts-expect-error minimal stub
    globalThis.navigator = {
      serviceWorker: { getRegistration: vi.fn().mockRejectedValue(new Error("boom")) },
    };
    expect(await checkForDriverAppUpdate()).toBe("unsupported");
  });
});
