import type { CatalogChannel, CatalogMenu, CatalogMenuStatus } from "./types";

const CHANNELS: CatalogChannel[] = ["delivery", "pickup", "dine_in", "qr", "totem", "marketplace", "api"];
const STATUSES: CatalogMenuStatus[] = ["draft", "published", "archived", "scheduled"];

const STATUS_TRANSITIONS: Record<CatalogMenuStatus, CatalogMenuStatus[]> = {
  draft: ["published", "scheduled", "archived"],
  scheduled: ["published", "draft", "archived"],
  published: ["draft", "archived", "scheduled"],
  archived: ["draft"],
};

export interface CatalogValidationIssue { field: string; message: string; }
export interface CatalogValidationResult { ok: boolean; issues: CatalogValidationIssue[]; }

export const CatalogValidator = {
  validateMenu(input: Partial<CatalogMenu>): CatalogValidationResult {
    const issues: CatalogValidationIssue[] = [];
    if (!input.name || String(input.name).trim().length < 2) {
      issues.push({ field: "name", message: "Nome do cardápio é obrigatório." });
    }
    if (input.channel && !CHANNELS.includes(input.channel)) {
      issues.push({ field: "channel", message: `Canal inválido. Use: ${CHANNELS.join(", ")}.` });
    }
    if (input.status && !STATUSES.includes(input.status)) {
      issues.push({ field: "status", message: `Status inválido.` });
    }
    if (input.available_start_time && input.available_end_time
        && input.available_end_time <= input.available_start_time) {
      issues.push({ field: "available_end_time", message: "Horário final deve ser após o inicial." });
    }
    if (input.available_days && input.available_days.some((d) => d < 0 || d > 6)) {
      issues.push({ field: "available_days", message: "Dias devem estar entre 0 (dom) e 6 (sáb)." });
    }
    return { ok: issues.length === 0, issues };
  },

  canTransition(from: CatalogMenuStatus, to: CatalogMenuStatus): boolean {
    if (from === to) return true;
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  },

  assertTransition(from: CatalogMenuStatus, to: CatalogMenuStatus): void {
    if (!CatalogValidator.canTransition(from, to)) {
      throw new Error(`Invalid menu status transition: ${from} → ${to}`);
    }
  },
} as const;
