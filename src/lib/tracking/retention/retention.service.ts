// TrackingRetentionService — RC5.3.x.3.
// Responsabilidade única: identificar registros elegíveis e gerar relatório.
// NUNCA exclui, nunca move, nunca muta. Apenas observa.

import { supabase } from "@/integrations/supabase/client";
import {
  TRACKING_RETENTION_POLICIES,
  type RetentionPolicy,
  type RetentionTier,
} from "./retention.policy";

export interface RetentionTierReport {
  tier: RetentionTier;
  count: number;
  oldest_at: string | null;
  newest_at: string | null;
  approx_bytes: number; // estimativa (count * avg row size)
}

export interface RetentionTableReport {
  table: string;
  policy: RetentionPolicy;
  total: number;
  tiers: RetentionTierReport[];
  generated_at: string;
  correlation_id: string;
}

// Estimativa conservadora de bytes por linha para cada tabela do domínio.
const AVG_ROW_BYTES: Record<string, number> = {
  tracking_timeline: 512,
  tracking_eta_history: 384,
};

function daysAgoIso(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function newCorrelationId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `ret_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export interface RetentionQueryClient {
  countBetween(table: string, fromExclusiveIso: string | null, toInclusiveIso: string | null): Promise<number>;
  boundsBetween(table: string, fromExclusiveIso: string | null, toInclusiveIso: string | null): Promise<{ oldest: string | null; newest: string | null }>;
}

// Cliente Supabase padrão (produção). Substituível em testes.
export const supabaseRetentionClient: RetentionQueryClient = {
  async countBetween(table, fromExclusiveIso, toInclusiveIso) {
    let q = (supabase as any).from(table).select("id", { count: "exact", head: true });
    if (fromExclusiveIso) q = q.gt("created_at", fromExclusiveIso);
    if (toInclusiveIso) q = q.lte("created_at", toInclusiveIso);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  },
  async boundsBetween(table, fromExclusiveIso, toInclusiveIso) {
    const base = (supabase as any).from(table).select("created_at");
    let qOld = base;
    let qNew = base;
    if (fromExclusiveIso) { qOld = qOld.gt("created_at", fromExclusiveIso); qNew = qNew.gt("created_at", fromExclusiveIso); }
    if (toInclusiveIso)   { qOld = qOld.lte("created_at", toInclusiveIso); qNew = qNew.lte("created_at", toInclusiveIso); }
    const [{ data: o }, { data: n }] = await Promise.all([
      qOld.order("created_at", { ascending: true }).limit(1),
      qNew.order("created_at", { ascending: false }).limit(1),
    ]);
    return {
      oldest: o?.[0]?.created_at ?? null,
      newest: n?.[0]?.created_at ?? null,
    };
  },
};

export interface RetentionServiceOptions {
  client?: RetentionQueryClient;
  now?: () => Date;
  logger?: (event: { level: "info" | "warn"; msg: string; correlation_id: string; data?: Record<string, unknown> }) => void;
}

export interface TrackingRetentionService {
  preview(table: keyof typeof TRACKING_RETENTION_POLICIES, correlationId?: string): Promise<RetentionTableReport>;
  previewAll(correlationId?: string): Promise<RetentionTableReport[]>;
}

export function createTrackingRetentionService(opts: RetentionServiceOptions = {}): TrackingRetentionService {
  const client = opts.client ?? supabaseRetentionClient;
  const nowFn = opts.now ?? (() => new Date());
  const log = opts.logger ?? ((e) => console.info("[tracking-retention]", JSON.stringify(e)));

  async function preview(tableKey: keyof typeof TRACKING_RETENTION_POLICIES, correlationId?: string): Promise<RetentionTableReport> {
    const policy = TRACKING_RETENTION_POLICIES[tableKey];
    if (!policy) throw new Error(`Unknown tracking table: ${tableKey}`);
    const cid = correlationId ?? newCorrelationId();
    const now = nowFn();
    const avgBytes = AVG_ROW_BYTES[policy.table] ?? 256;

    const onlineFromIso = daysAgoIso(policy.onlineDays, now); // > onlineFromIso é ONLINE
    const archiveFromIso = daysAgoIso(policy.archiveDays, now); // (archiveFromIso, onlineFromIso] = ARCHIVE
    // PURGE = <= archiveFromIso

    log({ level: "info", msg: "retention.preview.start", correlation_id: cid, data: { table: policy.table } });

    const [onlineCount, archiveCount, purgeCount, onlineBounds, archiveBounds, purgeBounds] = await Promise.all([
      client.countBetween(policy.table, onlineFromIso, null),
      client.countBetween(policy.table, archiveFromIso, onlineFromIso),
      client.countBetween(policy.table, null, archiveFromIso),
      client.boundsBetween(policy.table, onlineFromIso, null),
      client.boundsBetween(policy.table, archiveFromIso, onlineFromIso),
      client.boundsBetween(policy.table, null, archiveFromIso),
    ]);

    const tiers: RetentionTierReport[] = [
      { tier: "ONLINE",  count: onlineCount,  oldest_at: onlineBounds.oldest,  newest_at: onlineBounds.newest,  approx_bytes: onlineCount * avgBytes },
      { tier: "ARCHIVE", count: archiveCount, oldest_at: archiveBounds.oldest, newest_at: archiveBounds.newest, approx_bytes: archiveCount * avgBytes },
      { tier: "PURGE",   count: purgeCount,   oldest_at: purgeBounds.oldest,   newest_at: purgeBounds.newest,   approx_bytes: purgeCount * avgBytes },
    ];
    const total = onlineCount + archiveCount + purgeCount;

    const report: RetentionTableReport = {
      table: policy.table,
      policy,
      total,
      tiers,
      generated_at: now.toISOString(),
      correlation_id: cid,
    };

    log({
      level: "info",
      msg: "retention.preview.done",
      correlation_id: cid,
      data: { table: policy.table, total, tiers: tiers.map((t) => ({ tier: t.tier, count: t.count })) },
    });

    if (purgeCount > 0) {
      log({ level: "warn", msg: "retention.purge_eligible", correlation_id: cid, data: { table: policy.table, count: purgeCount } });
    }
    return report;
  }

  async function previewAll(correlationId?: string): Promise<RetentionTableReport[]> {
    const cid = correlationId ?? newCorrelationId();
    const tables = Object.keys(TRACKING_RETENTION_POLICIES) as Array<keyof typeof TRACKING_RETENTION_POLICIES>;
    return Promise.all(tables.map((t) => preview(t, cid)));
  }

  return { preview, previewAll };
}

export const trackingRetentionService = createTrackingRetentionService();
