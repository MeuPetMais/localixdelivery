import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260829133830_admin_fin_4_realized_platform_revenue.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

type Snapshot = {
  platform_revenue: number;
  realized_platform_revenue: number;
} | null;

function applyRevenueRecognition(nextStatus: string, snapshot: Snapshot): Snapshot {
  if (!snapshot) return null;
  if (nextStatus === "entregue" || nextStatus === "concluido") {
    return {
      ...snapshot,
      realized_platform_revenue: snapshot.platform_revenue,
    };
  }
  if (nextStatus === "reembolsado" || nextStatus === "chargeback") {
    return {
      ...snapshot,
      realized_platform_revenue: 0,
    };
  }
  return snapshot;
}

describe("ADMIN-FIN-4 realized platform revenue recognition", () => {
  it("recognizes platform revenue when the order reaches entregue", () => {
    const snapshot = { platform_revenue: 0.99, realized_platform_revenue: 0 };

    expect(applyRevenueRecognition("entregue", snapshot)).toMatchObject({
      platform_revenue: 0.99,
      realized_platform_revenue: 0.99,
    });
  });

  it("keeps entregue idempotent when the same recognition rule runs again", () => {
    const once = applyRevenueRecognition("entregue", {
      platform_revenue: 0.99,
      realized_platform_revenue: 0,
    });
    const twice = applyRevenueRecognition("entregue", once);

    expect(twice?.realized_platform_revenue).toBe(0.99);
  });

  it("keeps entregue -> concluido equal to the persisted platform revenue", () => {
    const delivered = applyRevenueRecognition("entregue", {
      platform_revenue: 0.99,
      realized_platform_revenue: 0,
    });

    expect(applyRevenueRecognition("concluido", delivered)?.realized_platform_revenue).toBe(0.99);
  });

  it("reverses realized revenue on refund", () => {
    const realized = { platform_revenue: 0.99, realized_platform_revenue: 0.99 };

    expect(applyRevenueRecognition("reembolsado", realized)?.realized_platform_revenue).toBe(0);
  });

  it("reverses realized revenue on chargeback", () => {
    const realized = { platform_revenue: 0.99, realized_platform_revenue: 0.99 };

    expect(applyRevenueRecognition("chargeback", realized)?.realized_platform_revenue).toBe(0);
  });

  it("does not realize revenue on falha_pagamento", () => {
    const snapshot = { platform_revenue: 0.99, realized_platform_revenue: 0 };

    expect(applyRevenueRecognition("falha_pagamento", snapshot)?.realized_platform_revenue).toBe(0);
  });

  it("does not realize revenue when cancelled before realization", () => {
    const snapshot = { platform_revenue: 0.99, realized_platform_revenue: 0 };

    expect(applyRevenueRecognition("cancelado", snapshot)?.realized_platform_revenue).toBe(0);
  });

  it("does not invent finance data when the snapshot is missing", () => {
    expect(applyRevenueRecognition("entregue", null)).toBeNull();
    expect(applyRevenueRecognition("reembolsado", null)).toBeNull();
  });

  it("uses the persisted platform_revenue value without hardcoding 0.99", () => {
    const snapshot = { platform_revenue: 1.49, realized_platform_revenue: 0 };

    expect(applyRevenueRecognition("entregue", snapshot)?.realized_platform_revenue).toBe(1.49);
  });

  it("keeps zero platform revenue as zero", () => {
    const snapshot = { platform_revenue: 0, realized_platform_revenue: 0 };

    expect(applyRevenueRecognition("entregue", snapshot)?.realized_platform_revenue).toBe(0);
  });

  it("does not duplicate revenue on retry/reexecution", () => {
    const snapshot = { platform_revenue: 1.49, realized_platform_revenue: 0 };

    const result = Array.from({ length: 5 }).reduce(
      (current) => applyRevenueRecognition("entregue", current),
      snapshot as Snapshot,
    );

    expect(result?.realized_platform_revenue).toBe(1.49);
  });

  it("implements the rule inside the atomic order_apply_transition RPC", () => {
    const updateOrderIndex = migrationSql.indexOf("UPDATE public.orders");
    const updateSnapshotIndex = migrationSql.indexOf("UPDATE public.order_pricing_snapshot");
    const historyIndex = migrationSql.indexOf("INSERT INTO public.order_status_history");

    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.order_apply_transition");
    expect(updateOrderIndex).toBeGreaterThan(0);
    expect(updateSnapshotIndex).toBeGreaterThan(updateOrderIndex);
    expect(updateSnapshotIndex).toBeLessThan(historyIndex);
    expect(migrationSql).toContain("realized_platform_revenue = CASE");
    expect(migrationSql).toContain("WHEN _next_status IN ('entregue', 'concluido') THEN platform_revenue");
    expect(migrationSql).toContain("WHEN _next_status IN ('reembolsado', 'chargeback') THEN 0");
    expect(migrationSql).toContain("ELSE realized_platform_revenue");
    expect(migrationSql).toContain("WHERE order_id = _order_id");
  });

  it("does not introduce unsafe finance inputs or gateway/frontend changes", () => {
    const snapshotUpdate = migrationSql.slice(
      migrationSql.indexOf("UPDATE public.order_pricing_snapshot"),
      migrationSql.indexOf("INSERT INTO public.order_status_history"),
    );

    expect(snapshotUpdate).toContain("THEN platform_revenue");
    expect(snapshotUpdate).not.toContain("orders.total");
    expect(snapshotUpdate).not.toContain("_metadata");
    expect(snapshotUpdate).not.toContain("0.99");
    expect(snapshotUpdate).not.toContain("0.05");
    expect(snapshotUpdate).not.toContain("transaction_amount");
    expect(snapshotUpdate).not.toContain("payment_amount");
  });
});
