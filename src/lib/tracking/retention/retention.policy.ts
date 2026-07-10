// Tracking Retention — Política oficial (RC5.3.x.3).
// Retention é OBSERVACIONAL: nunca exclui automaticamente. Apenas classifica.
//
// tracking_timeline / tracking_eta_history:
//   0–90 dias    → ONLINE   (hot storage, consultas frequentes)
//   91–365 dias  → ARCHIVE  (cold storage, consulta sob demanda)
//   > 365 dias   → PURGE    (elegível para expurgo manual/administrativo)

export type RetentionTier = "ONLINE" | "ARCHIVE" | "PURGE";

export interface RetentionPolicy {
  table: string;
  onlineDays: number;   // < onlineDays  → ONLINE
  archiveDays: number;  // < archiveDays → ARCHIVE, senão PURGE
}

export const TRACKING_RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  tracking_timeline: {
    table: "tracking_timeline",
    onlineDays: 90,
    archiveDays: 365,
  },
  tracking_eta_history: {
    table: "tracking_eta_history",
    onlineDays: 90,
    archiveDays: 365,
  },
};

export function classifyAge(ageDays: number, policy: RetentionPolicy): RetentionTier {
  if (ageDays < policy.onlineDays) return "ONLINE";
  if (ageDays < policy.archiveDays) return "ARCHIVE";
  return "PURGE";
}

export function classifyDate(createdAt: string | Date, policy: RetentionPolicy, now: Date = new Date()): RetentionTier {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const ageDays = Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
  return classifyAge(ageDays, policy);
}
