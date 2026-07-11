// Pure helpers used by the operations-central server function.
// Extracted so we can unit test without touching Supabase.

export type CentralGroup = "fila" | "em_entrega" | "retornando" | "pausa" | "offline";

export type DriverLite = { id: string; status: string; online: boolean };
export type QueueLite = { driver_id: string; status: string; position: number };
export type AssignmentLite = {
  driver_id: string | null; status: string;
  assigned_at: string | null; delivered_at: string | null;
};

const ACTIVE_STATUSES = new Set(["ATRIBUIDO", "COLETANDO", "EM_ROTA"]);

export function classifyDriver(
  d: DriverLite,
  queue: QueueLite | undefined,
  activeAssignment: AssignmentLite | undefined,
): CentralGroup {
  if (d.status === "afastado") return "pausa";
  if (activeAssignment && ACTIVE_STATUSES.has(activeAssignment.status)) return "em_entrega";
  if (queue?.status === "RETORNANDO") return "retornando";
  if (queue?.status === "AGUARDANDO") return "fila";
  if (d.online) return "fila";
  return "offline";
}

export function averageMinutes(deltas: number[]): number | null {
  if (deltas.length === 0) return null;
  const total = deltas.reduce((s, v) => s + v, 0);
  return Math.round(total / deltas.length);
}

/** Retorna gaps (min) entre delivered_at e o assigned_at seguinte para o mesmo motoboy. */
export function returnGapsMinutes(assignments: AssignmentLite[]): number[] {
  const byDriver = new Map<string, AssignmentLite[]>();
  for (const a of assignments) {
    if (!a.driver_id) continue;
    const list = byDriver.get(a.driver_id) ?? [];
    list.push(a);
    byDriver.set(a.driver_id, list);
  }
  const gaps: number[] = [];
  for (const list of byDriver.values()) {
    const asc = [...list].sort((x, y) => (x.assigned_at ?? "").localeCompare(y.assigned_at ?? ""));
    for (let i = 0; i < asc.length - 1; i++) {
      const prev = asc[i], next = asc[i + 1];
      if (prev.status !== "ENTREGUE" || !prev.delivered_at || !next.assigned_at) continue;
      const gap = (new Date(next.assigned_at).getTime() - new Date(prev.delivered_at).getTime()) / 60000;
      if (gap >= 0 && gap <= 120) gaps.push(gap);
    }
  }
  return gaps;
}
