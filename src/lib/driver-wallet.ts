// RC5.2.e — Driver Wallet helpers (client-side)
// Formato bancário, metas locais, e cálculos de comparação.

export const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type DriverGoals = {
  daily: number;
  weekly: number;
  monthly: number;
};

const KEY = (driverId: string) => `localix:driver-goals:${driverId}`;

export const DEFAULT_GOALS: DriverGoals = { daily: 15, weekly: 90, monthly: 360 };

export function loadGoals(driverId: string): DriverGoals {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = window.localStorage.getItem(KEY(driverId));
    if (!raw) return DEFAULT_GOALS;
    const parsed = JSON.parse(raw);
    return {
      daily: Number(parsed.daily) || DEFAULT_GOALS.daily,
      weekly: Number(parsed.weekly) || DEFAULT_GOALS.weekly,
      monthly: Number(parsed.monthly) || DEFAULT_GOALS.monthly,
    };
  } catch {
    return DEFAULT_GOALS;
  }
}

export function saveGoals(driverId: string, g: DriverGoals) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY(driverId), JSON.stringify(g));
}

export function pct(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

export function delta(current: number, previous: number): { pct: number; up: boolean } {
  if (previous <= 0) return { pct: current > 0 ? 100 : 0, up: current >= 0 };
  const d = ((current - previous) / previous) * 100;
  return { pct: Math.round(Math.abs(d)), up: d >= 0 };
}

export function formatMinutes(min: number): string {
  if (!min || !isFinite(min)) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${m ? ` ${m}min` : ""}`;
}
