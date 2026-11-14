/**
 * Gate 4/H2 source-only DDL inventory. Never connects to a database, and never
 * executes SQL. Scans all versioned migrations for provenance of financial
 * tables/RPCs and their ALTER TABLE, index, trigger and policy touch points.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const GATE4_TABLES = [
  "restaurants",
  "orders",
  "order_pricing_snapshot",
  "order_payment",
  "payments",
  "financial_ledger",
  "payment_webhook_events",
  "payment_event_queue",
  "mercado_pago_accounts",
  "checkout_order_idempotency",
] as const;

export const GATE4_FUNCTIONS = [
  "create_order_with_snapshot_payment",
  "get_restaurant_financial_snapshot",
] as const;

export type SourceDeclaration = {
  kind: "CREATE TABLE" | "ALTER TABLE" | "INDEX" | "TRIGGER" | "POLICY" | "FUNCTION";
  name: string;
  file: string;
  line: number;
  statement: string;
};

/**
 * This is a source-text inventory, NOT a SQL parser. In particular, dynamic
 * EXECUTE SQL and statement dependencies may require manual follow-up.
 */
export function inventoryGate4Sources(migrationsDir: string): SourceDeclaration[] {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const tables = new Set<string>(GATE4_TABLES);
  const fns = new Set<string>(GATE4_FUNCTIONS);
  const matches: SourceDeclaration[] = [];
  for (const file of files) {
    const lines = readFileSync(resolve(migrationsDir, file), "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const s = line.trim();
      if (/^(--|\/\*|\*)/.test(s)) return;
      const create = s.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z_0-9]*)"?/i);
      const alter = s.match(/^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z_0-9]*)"?/i);
      const fn = s.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-z_][a-z_0-9]*)"?/i);
      let kind: SourceDeclaration["kind"] | undefined;
      let name: string | undefined;
      if (create) { kind = "CREATE TABLE"; name = create[1].toLowerCase(); }
      else if (alter) { kind = "ALTER TABLE"; name = alter[1].toLowerCase(); }
      else if (fn) { kind = "FUNCTION"; name = fn[1].toLowerCase(); }
      else if (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(s) && /financial_ledger|payment|queue|order|restaurant|checkout/i.test(s)) {
        kind = "INDEX"; name = s.match(/(?:INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?)((?:public\.)?[a-z_0-9]+)/i)?.[1] ?? "unknown";
      }
      else if (/^CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i.test(s)) { kind = "TRIGGER"; name = s.match(/TRIGGER\s+([a-z_0-9]+)/i)?.[1] ?? "unknown"; }
      else if (/^CREATE\s+POLICY\b/i.test(s)) { kind = "POLICY"; name = s.match(/POLICY\s+(?:"([^"]+)"|([a-z_0-9]+))/i)?.[1] ?? s.match(/POLICY\s+([a-z_0-9]+)/i)?.[1] ?? "unknown"; }
      if (!kind || !name) return;
      if ((kind === "FUNCTION" && !fns.has(name)) || ((kind === "CREATE TABLE" || kind === "ALTER TABLE") && !tables.has(name))) return;
      matches.push({ kind, name, file, line: index + 1, statement: s.slice(0, 180) });
    });
  }
  return matches;
}

export function createGate4SourceReport(migrationsDir: string) {
  const declarations = inventoryGate4Sources(migrationsDir);
  return {
    tables: GATE4_TABLES.map((name) => ({
      name,
      origins: declarations.filter((x) => x.kind === "CREATE TABLE" && x.name === name),
      alterations: declarations.filter((x) => x.kind === "ALTER TABLE" && x.name === name),
    })),
    functions: GATE4_FUNCTIONS.map((name) => ({
      name,
      definitions: declarations.filter((x) => x.kind === "FUNCTION" && x.name === name),
    })),
    supportingObjects: declarations.filter((x) => ["INDEX", "TRIGGER", "POLICY"].includes(x.kind)),
  };
}
