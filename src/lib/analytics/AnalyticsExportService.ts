import type { DashboardSnapshot, ExportFormat, ExportResult } from "./types";

function toCsv(snap: DashboardSnapshot): string {
  const rows: string[][] = [["section", "kpi", "label", "value", "previous", "delta_pct", "trend"]];
  for (const s of snap.sections) {
    for (const k of s.kpis) {
      rows.push([
        s.title, k.key, k.label, String(k.value),
        k.previous != null ? String(k.previous) : "",
        k.deltaPct != null ? String(k.deltaPct) : "",
        k.trend ?? "",
      ]);
    }
  }
  return rows.map(r => r.map(cell => {
    const v = String(cell ?? "");
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(",")).join("\n");
}

function b64(str: string): string {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(str)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B: any = (globalThis as any).Buffer;
  return B ? B.from(str, "utf-8").toString("base64") : str;
}

export const AnalyticsExportService = {
  export(snapshot: DashboardSnapshot, format: ExportFormat, filename?: string): ExportResult {
    const base = filename ?? `analytics_${snapshot.scope}_${Date.now()}`;
    if (format === "csv") {
      const content = toCsv(snapshot);
      return {
        format, filename: `${base}.csv`, mimeType: "text/csv",
        content, bytes: content.length,
      };
    }
    // xlsx / pdf: placeholder payloads reusing csv structure until report infra is wired.
    const csv = toCsv(snapshot);
    const encoded = b64(csv);
    return {
      format,
      filename: `${base}.${format}`,
      mimeType: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: encoded,
      bytes: encoded.length,
    };
  },
};
