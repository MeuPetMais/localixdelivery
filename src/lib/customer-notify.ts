/**
 * Preferências e utilitários de notificação do cliente.
 * - Sons via WebAudio (com unlock no primeiro gesto).
 * - Vibração (best-effort).
 * - Notification API quando a aba estiver oculta.
 *
 * Config persistida em localStorage: sons / vibração / notificações.
 */

export type CustomerNotifyPrefs = {
  sound: boolean;
  vibration: boolean;
  notifications: boolean;
};

const LS_KEY = "localix.customer.notify.prefs";
const DEFAULTS: CustomerNotifyPrefs = { sound: true, vibration: true, notifications: true };

export function getNotifyPrefs(): CustomerNotifyPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setNotifyPrefs(patch: Partial<CustomerNotifyPrefs>): CustomerNotifyPrefs {
  const next = { ...getNotifyPrefs(), ...patch };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new CustomEvent("localix:notify-prefs", { detail: next }));
  return next;
}

/* -------------------------- Audio (WebAudio unlock) -------------------------- */

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Registra listeners únicos para "destravar" o áudio no primeiro gesto.
 * Deve ser chamado no mount do provider — idempotente.
 */
export function installAudioUnlock() {
  if (typeof window === "undefined" || unlocked) return;
  const unlock = () => {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        console.log("[notify] AudioContext desbloqueado");
      }).catch((e) => console.warn("[notify] resume falhou", e));
    }
    unlocked = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
}

export function playNotificationSound() {
  const prefs = getNotifyPrefs();
  if (!prefs.sound) {
    console.log("[notify] Som desativado nas preferências");
    return;
  }
  const ctx = getCtx();
  if (!ctx) {
    console.warn("[notify] AudioContext indisponível — som bloqueado");
    return;
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  try {
    const now = ctx.currentTime;
    const notes = [
      { f: 880, t: 0, d: 0.16 },
      { f: 1174, t: 0.18, d: 0.2 },
      { f: 1568, t: 0.4, d: 0.26 },
    ];
    for (const n of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = n.f;
      g.gain.setValueAtTime(0, now + n.t);
      g.gain.linearRampToValueAtTime(0.2, now + n.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      o.connect(g).connect(ctx.destination);
      o.start(now + n.t);
      o.stop(now + n.t + n.d + 0.05);
    }
    console.log("[notify] Som executado");
  } catch (err) {
    console.error("[notify] audio.play() rejeitado:", err);
  }
}

/* --------------------------------- Vibração --------------------------------- */

export function vibrateNotification(pattern: number | number[] = [250, 100, 250]) {
  const prefs = getNotifyPrefs();
  if (!prefs.vibration) {
    console.log("[notify] Vibração desativada nas preferências");
    return;
  }
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    console.log("[notify] Vibração não suportada neste dispositivo");
    return;
  }
  try {
    const ok = navigator.vibrate(pattern);
    console.log("[notify] Vibração executada:", ok);
  } catch (err) {
    console.warn("[notify] Vibração falhou:", err);
  }
}

/* ------------------------------ Notification API ------------------------------ */

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    const p = await Notification.requestPermission();
    console.log("[notify] Notification.requestPermission =>", p);
    return p;
  } catch (err) {
    console.warn("[notify] requestPermission falhou:", err);
    return "denied";
  }
}

export function showBackgroundNotification(input: {
  title: string;
  body?: string | null;
  tag?: string;
  url?: string;
}) {
  const prefs = getNotifyPrefs();
  if (!prefs.notifications) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(input.title, {
      body: input.body ?? undefined,
      tag: input.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    });
    n.onclick = () => {
      window.focus();
      if (input.url) window.location.assign(input.url);
      n.close();
    };
    console.log("[notify] Notification enviada:", input.title);
  } catch (err) {
    console.warn("[notify] Notification falhou:", err);
  }
}
