// RC5.2.f — DriverShiftService (I/O-agnóstico).
// Calcula transições de tempo entre estados e agrega métricas do turno.

import type { ShiftCurrentState } from "./DriverShiftStateMachine";

export interface ShiftAccumulators {
  online_minutes: number;
  waiting_minutes: number;
  delivery_minutes: number;
  return_minutes: number;
  pause_minutes: number;
}

export const ZERO_ACC: ShiftAccumulators = {
  online_minutes: 0,
  waiting_minutes: 0,
  delivery_minutes: 0,
  return_minutes: 0,
  pause_minutes: 0,
};

const FIELD: Record<ShiftCurrentState, keyof ShiftAccumulators | null> = {
  ONLINE: "online_minutes",
  AGUARDANDO: "waiting_minutes",
  EM_ENTREGA: "delivery_minutes",
  RETORNANDO: "return_minutes",
  PAUSA: "pause_minutes",
  OFFLINE: null,
};

/**
 * Adiciona ao acumulador o tempo (minutos) permanecido no estado atual até `to`.
 * Não muta o input; retorna novo objeto.
 */
export function accumulate(
  acc: ShiftAccumulators,
  state: ShiftCurrentState,
  from: Date | string,
  to: Date | string,
): ShiftAccumulators {
  const key = FIELD[state];
  if (!key) return acc;
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  const diff = Math.max(0, (b.getTime() - a.getTime()) / 60000);
  return { ...acc, [key]: acc[key] + diff };
}

export function summarize(acc: ShiftAccumulators) {
  const total =
    acc.online_minutes +
    acc.waiting_minutes +
    acc.delivery_minutes +
    acc.return_minutes +
    acc.pause_minutes;
  return { ...acc, total_minutes: total };
}

export function fmtMinutes(m: number): string {
  const mins = Math.round(m);
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return h > 0 ? `${h}h ${r.toString().padStart(2, "0")}m` : `${r}m`;
}
