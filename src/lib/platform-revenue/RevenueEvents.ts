// Barramento simples de eventos do domínio de receita da plataforma.
import type { RevenuePolicy, ServiceFeeCalculationResult } from "./types";

export type RevenueEvent =
  | { type: "RevenuePolicyChanged"; policy: RevenuePolicy; at: string }
  | { type: "ServiceFeeCalculated"; result: ServiceFeeCalculationResult; at: string }
  | { type: "ServiceFeeApplied"; result: ServiceFeeCalculationResult; orderId?: string; at: string }
  | { type: "ServiceFeeDisabled"; at: string };

type Listener = (e: RevenueEvent) => void;
const listeners = new Set<Listener>();

export const RevenueEvents = {
  on(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  emit(e: RevenueEvent) { for (const l of listeners) { try { l(e); } catch { /* noop */ } } },
};
