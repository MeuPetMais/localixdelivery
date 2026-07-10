// Comando administrativo — Retention Preview (RC5.3.x.3).
// Retorna relatório humanizado. Nunca executa exclusões.

import type { RetentionTableReport } from "./retention.service";
import { trackingRetentionService } from "./retention.service";

export interface RetentionPreviewLine {
  table: string;
  tier: "ONLINE" | "ARCHIVE" | "PURGE";
  count: number;
  approx_size_human: string;
  period_from: string | null;
  period_to: string | null;
}

export interface RetentionPreviewResult {
  correlation_id: string;
  generated_at: string;
  reports: RetentionTableReport[];
  lines: RetentionPreviewLine[];
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function retentionPreview(correlationId?: string): Promise<RetentionPreviewResult> {
  const reports = await trackingRetentionService.previewAll(correlationId);
  const lines: RetentionPreviewLine[] = reports.flatMap((r) =>
    r.tiers.map((t) => ({
      table: r.table,
      tier: t.tier,
      count: t.count,
      approx_size_human: humanBytes(t.approx_bytes),
      period_from: t.oldest_at,
      period_to: t.newest_at,
    })),
  );
  return {
    correlation_id: reports[0]?.correlation_id ?? "unknown",
    generated_at: reports[0]?.generated_at ?? new Date().toISOString(),
    reports,
    lines,
  };
}
