import { describe, it, expect, vi, afterEach } from "vitest";
import { checkForDriverAppUpdate } from "./pwa-driver-update";

const setNav = (v: unknown) => {
  Object.defineProperty(globalThis, "navigator", { value: v, configurable: true, writable: true });
};

describe("checkForDriverAppUpdate", () => {
  const original = (globalThis as any).navigator;
  afterEach(() => setNav(original));

  it("returns 'unsupported' when serviceWorker is missing", async () => {
    setNav({});
    expect(await checkForDriverAppUpdate()).toBe("unsupported");
  });

  it("returns 'unsupported' when no registration is present", async () => {
    setNav({ serviceWorker: { getRegistration: vi.fn().mockResolvedValue(null) } });
    expect(await checkForDriverAppUpdate()).toBe("unsupported");
  });

  it("returns 'current' when update produces no new worker", async () => {
    const reg = { waiting: null, installing: null, update: vi.fn().mockResolvedValue(undefined) };
    setNav({ serviceWorker: { getRegistration: vi.fn().mockResolvedValue(reg) } });
    expect(await checkForDriverAppUpdate()).toBe("current");
    expect(reg.update).toHaveBeenCalled();
  });

  it("returns 'updated' when a new worker is installed after update", async () => {
    let installing: unknown = null;
    const reg = {
      get waiting() { return null; },
      get installing() { return installing; },
      update: vi.fn().mockImplementation(async () => {
        installing = { state: "installing" };
      }),
    };
    setNav({ serviceWorker: { getRegistration: vi.fn().mockResolvedValue(reg) } });
    expect(await checkForDriverAppUpdate()).toBe("updated");
  });

  it("returns 'unsupported' on error", async () => {
    setNav({
      serviceWorker: { getRegistration: vi.fn().mockRejectedValue(new Error("boom")) },
    });
    expect(await checkForDriverAppUpdate()).toBe("unsupported");
  });
});
