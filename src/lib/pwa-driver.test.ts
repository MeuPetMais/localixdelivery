import { afterEach, describe, expect, it } from "vitest";
import {
  isChromeAndroid,
  isInstallSupported,
  isStandaloneDisplay,
} from "./pwa-driver";

const originalWindow = globalThis.window;

function setWindow(input: {
  userAgent: string;
  displayModeStandalone?: boolean;
  navigatorStandalone?: boolean;
  beforeInstallPromptProperty?: boolean;
}) {
  const win: any = {
    navigator: {
      userAgent: input.userAgent,
      standalone: input.navigatorStandalone,
    },
    matchMedia: () => ({ matches: !!input.displayModeStandalone }),
  };
  if (input.beforeInstallPromptProperty) {
    win.onbeforeinstallprompt = null;
  }
  Object.defineProperty(globalThis, "window", {
    value: win,
    configurable: true,
    writable: true,
  });
}

describe("driver PWA install detection", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it("treats Chrome Android as install-capable even without beforeinstallprompt", () => {
    setWindow({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    });

    expect(isChromeAndroid()).toBe(true);
    expect(isInstallSupported()).toBe(true);
  });

  it("detects standalone display mode as already installed", () => {
    setWindow({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36",
      displayModeStandalone: true,
    });

    expect(isStandaloneDisplay()).toBe(true);
    expect(isInstallSupported()).toBe(true);
  });

  it("detects iOS navigator.standalone as already installed", () => {
    setWindow({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      navigatorStandalone: true,
    });

    expect(isStandaloneDisplay()).toBe(true);
  });
});
