import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assessGate4DdlCandidate } from "./gate4-h2-ddl-extract";

const dir = resolve(process.cwd(), "supabase", "migrations");

describe("Gate 4 H2 — exact source CREATE TABLE extraction", () => {
  it("locates a single source CREATE TABLE for each critical table", () => {
    const result = assessGate4DdlCandidate(dir);
    expect(result.missing).toEqual([]);
    expect(result.ambiguous).toEqual([]);
    expect(result.tableCount).toBe(10);
  });

  it("keeps the candidate non-executable even when source DDL exists", () => {
    const result = assessGate4DdlCandidate(dir);
    expect(result.executable).toBe(false);
    expect(result.tables.every((t) => t.createTableSql.trimEnd().endsWith(";"))).toBe(true);
    expect(result.tables.every((t) => /^[a-f0-9]{64}$/.test(t.sha256))).toBe(true);
  });

  it("tracks real foreign references outside financial tables", () => {
    const result = assessGate4DdlCandidate(dir);
    const restaurants = result.tables.find((t) => t.table === "restaurants");
    expect(restaurants?.externalReferences).toContain("users");
  });
});
