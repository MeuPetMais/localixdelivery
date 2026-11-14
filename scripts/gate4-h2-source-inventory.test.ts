import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createGate4SourceReport } from "./gate4-h2-source-inventory";

const migrations = resolve(process.cwd(), "supabase", "migrations");

describe("Gate 4 H2 — source migration provenance (read-only)", () => {
  it("locates each critical table creation in versioned sources", () => {
    const report = createGate4SourceReport(migrations);
    const missing = report.tables.filter((t) => t.origins.length === 0).map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it("locates both application financial RPC definitions", () => {
    const report = createGate4SourceReport(migrations);
    const missing = report.functions.filter((f) => f.definitions.length === 0).map((f) => f.name);
    expect(missing).toEqual([]);
  });

  it("captures historical changes without applying any migration", () => {
    const report = createGate4SourceReport(migrations);
    const order = report.tables.find((t) => t.name === "orders");
    const ledger = report.tables.find((t) => t.name === "financial_ledger");
    expect(order?.alterations.length).toBeGreaterThan(0);
    expect(ledger?.origins.length).toBeGreaterThan(0);
    expect(report.supportingObjects.length).toBeGreaterThan(0);
  });
});
