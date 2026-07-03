import type { FinanceRole, FinanceTab } from "./types";

// Read-only permission matrix. Enforcement happens in RLS + server functions.
const MATRIX: Record<FinanceRole, FinanceTab[]> = {
  ADMIN:      ["summary", "cashflow", "receivables", "payables", "dre", "profitability", "reports"],
  MANAGER:    ["summary", "cashflow", "receivables", "payables", "dre", "profitability", "reports"],
  FINANCE:    ["summary", "cashflow", "receivables", "payables", "dre", "profitability", "reports"],
  ACCOUNTANT: ["summary", "cashflow", "dre", "reports"],
  VIEWER:     ["summary"],
};

export const FinancePermissions = {
  can(role: FinanceRole, tab: FinanceTab): boolean {
    return MATRIX[role]?.includes(tab) ?? false;
  },
  tabsFor(role: FinanceRole): FinanceTab[] {
    return MATRIX[role] ?? [];
  },
  canExport(role: FinanceRole): boolean {
    return role === "ADMIN" || role === "FINANCE" || role === "ACCOUNTANT";
  },
};
