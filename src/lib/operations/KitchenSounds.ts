// Infraestrutura de sons operacionais (arquitetura apenas — sem áudio real).
export type KitchenSoundEvent = "NEW_ORDER" | "ORDER_READY" | "ORDER_CANCELLED";

type Handler = (event: KitchenSoundEvent, meta?: Record<string, unknown>) => void;

const handlers = new Set<Handler>();
let enabled = false;

export const KitchenSounds = {
  enable(): void { enabled = true; },
  disable(): void { enabled = false; },
  isEnabled(): boolean { return enabled; },
  onPlay(h: Handler): () => void { handlers.add(h); return () => handlers.delete(h); },
  play(event: KitchenSoundEvent, meta?: Record<string, unknown>): void {
    if (!enabled) return;
    handlers.forEach((h) => { try { h(event, meta); } catch { /* noop */ } });
  },
};
