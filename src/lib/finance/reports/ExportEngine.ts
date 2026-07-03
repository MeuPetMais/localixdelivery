// ExportEngine — turns a ReportResult into a serialized payload.
// PDF/XLSX are produced as printable HTML / CSV surrogates in this
// foundation layer; heavier renderers can be plugged later without
// touching consumers (same interface).
import type { ExportFormat, ReportResult } from "./types";

export interface ExportPayload {
  filename: string;
  mimeType: string;
  format: ExportFormat;
  content: string; // text or data-url for binary
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(r: ReportResult): string {
  const head = r.columns.map(csvEscape).join(",");
  const body = r.rows.map(row => r.columns.map(c => csvEscape(row[c])).join(",")).join("\n");
  return head + "\n" + body;
}

function toHtml(r: ReportResult): string {
  const rows = r.rows.map(row => `<tr>${r.columns.map(c => `<td>${row[c] ?? ""}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>${r.title}</title>
<style>body{font:14px system-ui;padding:24px}h1{margin:0 0 8px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}th{background:#f8fafc}</style>
<h1>${r.title}</h1><p>Gerado em ${new Date(r.generatedAt).toLocaleString("pt-BR")}</p>
<table><thead><tr>${r.columns.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}

export class ExportEngine {
  export(result: ReportResult, format: ExportFormat): ExportPayload {
    const base = result.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const stamp = new Date().toISOString().slice(0, 10);
    switch (format) {
      case "csv":
        return { filename: `${base}-${stamp}.csv`, mimeType: "text/csv;charset=utf-8", format, content: toCsv(result) };
      case "xlsx":
        // Foundation layer: emit CSV bytes labelled as spreadsheet-compatible.
        return { filename: `${base}-${stamp}.csv`, mimeType: "text/csv;charset=utf-8", format, content: toCsv(result) };
      case "pdf":
        return { filename: `${base}-${stamp}.html`, mimeType: "text/html;charset=utf-8", format, content: toHtml(result) };
      case "json":
      default:
        return { filename: `${base}-${stamp}.json`, mimeType: "application/json", format: "json", content: JSON.stringify(result, null, 2) };
    }
  }
}
