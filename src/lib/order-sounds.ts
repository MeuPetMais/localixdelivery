/**
 * Gerenciador de sons dos pedidos.
 * Um único AudioContext, uma reprodução por evento (dedupe).
 * Sons sintetizados via Web Audio para não depender de assets.
 * Fácil de estender: adicionar entrada em SOUND_PRESETS.
 */

type ToneStep = {
  freq: number;
  delay?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
};

export type OrderSoundKey =
  | "new"
  | "accepted"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "canceled";

const SOUND_PRESETS: Record<OrderSoundKey, ToneStep[]> = {
  new: [
    { freq: 880, delay: 0, dur: 0.18 },
    { freq: 1174, delay: 0.2, dur: 0.22 },
    { freq: 1568, delay: 0.44, dur: 0.28 },
  ],
  accepted: [
    { freq: 660, delay: 0, dur: 0.14 },
    { freq: 990, delay: 0.14, dur: 0.22 },
  ],
  preparing: [{ freq: 740, delay: 0, dur: 0.22, type: "triangle" }],
  out_for_delivery: [
    { freq: 620, delay: 0, dur: 0.16 },
    { freq: 780, delay: 0.16, dur: 0.16 },
    { freq: 980, delay: 0.32, dur: 0.22 },
  ],
  delivered: [
    { freq: 880, delay: 0, dur: 0.14 },
    { freq: 1320, delay: 0.14, dur: 0.24 },
  ],
  canceled: [
    { freq: 440, delay: 0, dur: 0.22, type: "square", gain: 0.12 },
    { freq: 220, delay: 0.24, dur: 0.42, type: "square", gain: 0.12 },
  ],
};

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

export function playOrderSound(key: OrderSoundKey, opts?: { minGapMs?: number }) {
  const now = Date.now();
  const gap = opts?.minGapMs ?? 400;
  if (now - lastPlayedAt < gap) return; // dedupe (múltiplas assinaturas Realtime)
  lastPlayedAt = now;

  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") audio.resume().catch(() => {});

  const preset = SOUND_PRESETS[key];
  const t0 = audio.currentTime;
  preset.forEach(({ freq, delay = 0, dur = 0.25, type = "sine", gain = 0.18 }) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0 + delay);
    g.gain.linearRampToValueAtTime(gain, t0 + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
    o.connect(g).connect(audio.destination);
    o.start(t0 + delay);
    o.stop(t0 + delay + dur + 0.05);
  });
}

export function vibratePattern(pattern: number | number[] = [120, 60, 120]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {}
}
