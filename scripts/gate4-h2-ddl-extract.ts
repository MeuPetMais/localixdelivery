/**
 * Extract unmodified CREATE TABLE SQL from versioned migrations into a
 * provenance report. Read-only; NEVER executes SQL or connects to Supabase.
 * The output is a CANDIDATE, not an executable migration bundle: ALTERs,
 * RLS policies, triggers, foreign dependencies, and grants must be validated.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GATE4_TABLES } from "./gate4-h2-source-inventory";

export interface TableSource {
  table: string;
  migration: string;
  line: number;
  sha256: string;
  createTableSql: string;
  externalReferences: string[];
}

const tablePattern =
  /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z_0-9]*)"?\s*\(/gim;

/** Recognizes statement end outside single-quoted SQL values and SQL comments. */
function endOfStatement(source: string, start: number): number {
  let single = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (!single && c === "-" && next === "-") {
      lineComment = true;
      i++;
      continue;
    }
    if (!single && c === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }
    if (c === "'") {
      if (single && next === "'") {
        i++;
      } else {
        single = !single;
      }
      continue;
    }
    if (c === ";" && !single) return i + 1;
  }
  throw new Error("unterminated_create_table_statement");
}

export function extractGate4CreateTables(migrationsDir: string): TableSource[] {
  const wanted = new Set<string>(GATE4_TABLES);
  const found: TableSource[] = [];
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const migration of files) {
    const source = readFileSync(resolve(migrationsDir, migration), "utf8");
    const search = new RegExp(tablePattern);
    for (const match of source.matchAll(search)) {
      const name = match[1].toLowerCase();
      if (!wanted.has(name)) continue;
      const start = match.index;
      const end = endOfStatement(source, start);
      const sql = source.slice(start, end);
      const externalReferences = Array.from(
        sql.matchAll(/\bREFERENCES\s+(?:(?:public|auth)\.)?"?([a-z_][a-z_0-9]*)"?/gi),
        (m) => m[1].toLowerCase(),
      ).filter((ref) => !wanted.has(ref));
      found.push({
        table: name,
        migration,
        line: source.slice(0, start).split("\n").length,
        sha256: createHash("sha256").update(sql).digest("hex"),
        createTableSql: sql,
        externalReferences: [...new Set(externalReferences)].sort(),
      });
    }
  }
  return found;
}

export function assessGate4DdlCandidate(migrationsDir: string) {
  const tables = extractGate4CreateTables(migrationsDir);
  const missing = GATE4_TABLES.filter((t) => !tables.some((f) => f.table === t));
  const ambiguous = GATE4_TABLES.filter((t) => tables.filter((f) => f.table === t).length > 1);
  return {
    status: missing.length || ambiguous.length ? "BLOCKED" : "SOURCE_EXTRACTED",
    tableCount: tables.length,
    missing,
    ambiguous,
    tables,
    executable: false,
    reason:
      "CREATE TABLE only; source ALTER/RLS/RBAC/FKs/policies/triggers/grants and runtime closure not yet validated",
  } as const;
}
