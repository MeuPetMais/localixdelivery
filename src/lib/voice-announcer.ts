/**
 * Voice announcer — Web Speech API.
 * Configurações persistidas em localStorage; funciona em conjunto com o
 * sistema de sons existente (`playOrderSound`).
 *
 * Evita repetições: mantém `lastSpokenAt` e um "hash" da última mensagem
 * para não anunciar duas vezes o mesmo evento em uma janela curta.
 */

type VoiceSettings = {
  enabled: boolean;
  volume: number; // 0..1
  lang: string; // ex.: "pt-BR"
};

const LS_KEY = "localix.voice.settings";
const DEFAULTS: VoiceSettings = { enabled: true, volume: 1, lang: "pt-BR" };

let lastText = "";
let lastAt = 0;

export function isVoiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setVoiceSettings(patch: Partial<VoiceSettings>) {
  const next = { ...getVoiceSettings(), ...patch };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function speak(text: string, opts?: { dedupeMs?: number; force?: boolean }) {
  if (!isVoiceSupported()) return;
  const s = getVoiceSettings();
  if (!s.enabled) return;
  const now = Date.now();
  const gap = opts?.dedupeMs ?? 8000;
  if (!opts?.force && text === lastText && now - lastAt < gap) return;
  lastText = text;
  lastAt = now;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = s.lang;
    u.volume = Math.max(0, Math.min(1, s.volume));
    u.rate = 1;
    u.pitch = 1;
    // Cancela qualquer fala pendente para manter o alerta responsivo.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

/* --------------------------- Mensagens prontas --------------------------- */

export function announceNewOrder() {
  speak("Novo pedido recebido.");
}

export function announcePendingCount(count: number) {
  if (count <= 1) return; // já anunciamos "novo pedido"
  const n = numberToPtBr(count);
  speak(`Atenção. Existem ${n} pedidos aguardando confirmação.`);
}

export function announceLongWaiting(orderNumber: number | null) {
  if (!orderNumber) return;
  speak(`Pedido número ${orderNumber} aguardando confirmação.`);
}

function numberToPtBr(n: number): string {
  const words: Record<number, string> = {
    2: "dois", 3: "três", 4: "quatro", 5: "cinco", 6: "seis",
    7: "sete", 8: "oito", 9: "nove", 10: "dez",
  };
  return words[n] ?? String(n);
}
