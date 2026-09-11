import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260911160337_sync_orders_platform_fee_from_pricing_snapshot.sql",
);

const sql = readFileSync(migrationPath, "utf8");
const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

function mirrorSnapshotPlatformFee(snapshotPlatformFee: number) {
  return {
    platform_fee: snapshotPlatformFee,
    fixed_fee: snapshotPlatformFee,
  };
}

describe("order platform fee sync migration", () => {
  it("syncs orders fee fields from the authoritative pricing snapshot", () => {
    expect(normalizedSql).toContain("after insert on public.order_pricing_snapshot");
    expect(normalizedSql).toContain("update public.orders");
    expect(normalizedSql).toContain("platform_fee = new.platform_fee");
    expect(normalizedSql).toContain("fixed_fee = new.platform_fee");
    expect(normalizedSql).toContain("where id = new.order_id");
  });

  it("mirrors the R$0.99 authoritative fee even when customer_total crosses R$30", () => {
    const syncedOrderFields = mirrorSnapshotPlatformFee(0.99);

    expect(syncedOrderFields).toEqual({
      platform_fee: 0.99,
      fixed_fee: 0.99,
    });
  });

  it("mirrors the R$1.49 authoritative fee without recalculating it", () => {
    const syncedOrderFields = mirrorSnapshotPlatformFee(1.49);

    expect(syncedOrderFields).toEqual({
      platform_fee: 1.49,
      fixed_fee: 1.49,
    });
  });

  it("does not introduce a second fee formula or mutate checkout financial totals", () => {
    expect(normalizedSql).not.toContain("new.total");
    expect(normalizedSql).not.toContain("commission_rate");
    expect(normalizedSql).not.toContain("total =");
    expect(normalizedSql).not.toContain("status =");
    expect(normalizedSql).not.toContain("items =");
    expect(normalizedSql).not.toContain("payment_method =");
    expect(normalizedSql).not.toContain("customer_total =");
    expect(normalizedSql).not.toContain("subtotal =");
    expect(normalizedSql).not.toContain("delivery_fee =");
    expect(normalizedSql).not.toContain("gateway_fee =");
    expect(normalizedSql).not.toContain("restaurant_gross =");
    expect(normalizedSql).not.toContain("restaurant_net =");
    expect(normalizedSql).not.toContain("platform_revenue =");
  });

  it("keeps the trigger narrowly scoped to inserted pricing snapshots", () => {
    expect(normalizedSql).toContain("returns trigger");
    expect(normalizedSql).toContain("for each row");
    expect(normalizedSql).not.toContain("security definer");
    expect(normalizedSql).not.toContain("before insert on public.orders");
    expect(normalizedSql).not.toContain("delete from");
    expect(normalizedSql).not.toContain("insert into");
  });
});
