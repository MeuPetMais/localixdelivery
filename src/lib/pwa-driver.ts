// RC6.4 — Utilitários de instalação PWA do App do Entregador.
// Registra um SW mínimo (só em produção fora do preview) e expõe hook
// `useDriverPwaInstall()` para orquestrar o `beforeinstallprompt`.

import { useCallback, useEffect, useState } from "react";

const SW_URL = "/driver-sw.js";
const DISMISS_KEY = "localix-driver-pwa-dismissed";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type DriverPwaInstallAvailability =
  | "available"
  | "installed"
  | "manual"
  | "unsupported";

function isPreviewHost(hostname: string): boolean {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

function isRegistrationAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  if (isPreviewHost(window.location.hostname)) return false;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return false;
  return true;
}

async function unregisterDriverSw(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => r.active?.scriptURL.endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

/** Registra o SW do Entregador quando o contexto for válido. */
export async function registerDriverServiceWorker(): Promise<void> {
  if (!isRegistrationAllowed()) {
    await unregisterDriverSw();
    return;
  }
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    /* noop */
  }
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !!mm || !!iosStandalone;
}

export function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && "ontouchend" in document);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export function isChromeAndroid(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /Android/.test(ua) && /Chrome\//.test(ua) && !/EdgA|OPR|SamsungBrowser/.test(ua);
}

export function isInstallSupported(): boolean {
  if (typeof window === "undefined") return false;
  // Chrome/Edge/Samsung: `BeforeInstallPromptEvent` disponível.
  // Safari iOS: usa "Adicionar à Tela Inicial" manual.
  return (
    isStandaloneDisplay() ||
    "onbeforeinstallprompt" in window ||
    isChromeAndroid() ||
    isIOSSafari()
  );
}

export function markInstallDismissed(): void {
  try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
}

export function wasInstallDismissed(): boolean {
  try { return window.localStorage.getItem(DISMISS_KEY) === "1"; }
  catch { return false; }
}

export function clearInstallDismissed(): void {
  try { window.localStorage.removeItem(DISMISS_KEY); } catch { /* noop */ }
}

export type PwaInstallState = {
  /** Evento `beforeinstallprompt` capturado (Chrome/Edge/Samsung). */
  canPrompt: boolean;
  /** O usuário está usando Safari iOS (instruções manuais). */
  isIOS: boolean;
  /** O app já está instalado / rodando em standalone. */
  isStandalone: boolean;
  /** Navegador dá suporte a alguma forma de instalação. */
  isSupported: boolean;
  availability: DriverPwaInstallAvailability;
  isServiceWorkerControlled: boolean;
  /** Dispara o prompt nativo. Retorna outcome ou null se indisponível. */
  promptInstall: () => Promise<"accepted" | "dismissed" | null>;
};

export function useDriverPwaInstall(): PwaInstallState {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState<boolean>(() => isStandaloneDisplay());
  const [serviceWorkerControlled, setServiceWorkerControlled] = useState<boolean>(() =>
    typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBIP = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setEvt(null);
      setStandalone(true);
      clearInstallDismissed();
    };
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onModeChange = () => setStandalone(isStandaloneDisplay());
    const onControllerChange = () => setServiceWorkerControlled(!!navigator.serviceWorker?.controller);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    navigator.serviceWorker?.addEventListener?.("controllerchange", onControllerChange);
    mq?.addEventListener?.("change", onModeChange);
    setServiceWorkerControlled(!!navigator.serviceWorker?.controller);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener?.("controllerchange", onControllerChange);
      mq?.removeEventListener?.("change", onModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!evt) return null;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      setEvt(null);
      return choice.outcome;
    } catch {
      return null;
    }
  }, [evt]);

  const supported = isInstallSupported();
  const canPrompt = !!evt && !standalone;
  const availability: DriverPwaInstallAvailability = standalone
    ? "installed"
    : canPrompt
      ? "available"
      : supported
        ? "manual"
        : "unsupported";

  return {
    canPrompt,
    isIOS: isIOSSafari(),
    isStandalone: standalone,
    isSupported: supported,
    availability,
    isServiceWorkerControlled: serviceWorkerControlled,
    promptInstall,
  };
}
