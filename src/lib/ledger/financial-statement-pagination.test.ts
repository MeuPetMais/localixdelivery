import { describe, it, expect } from "vitest";
import { readFinancialSnapshot, snapshotStatement } from "./financial-statement-pagination";
const restaurant = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
function entry(index: number) {
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    order_id: restaurant,
    restaurant_id: restaurant,
    customer_id: null,
    provider: "synthetic",
    transaction_type: "PAYMENT_APPROVED",
    reference_type: "payment",
    reference_id: String(index),
    amount: 1,
    currency: "BRL",
    status: "COMPLETED",
    description: null,
    metadata: {},
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  };
}
function envelope(total: number) {
  return {
    version: 1,
    restaurant_id: restaurant,
    snapshot_at: "2026-11-11T00:00:00Z",
    row_count: total,
    complete: true,
    entries: Array.from({ length: total }, (_, i) => entry(i)),
  };
}
describe("transactional financial snapshot boundary", () => {
  it.each([0, 501, 1000, 1201, 10001, 50000])(
    "accepts the complete scalar snapshot of %i rows",
    async (total) => {
      const snapshot = await readFinancialSnapshot(async () => envelope(total), restaurant);
      expect(snapshot.entries).toHaveLength(total);
    },
  );
  it("rejects a transport response capped at 100 despite requesting more than 500", async () => {
    const data = envelope(1201);
    data.entries = data.entries.slice(0, 100);
    await expect(readFinancialSnapshot(async () => data, restaurant)).rejects.toThrow("row count");
  });
  it.each(["duplicate", "missing", "tenant", "currency", "incomplete", "cap"])(
    "rejects invalid snapshot %s",
    async (kind) => {
      const data = envelope(2);
      if (kind === "duplicate") data.entries[1] = data.entries[0];
      if (kind === "missing") data.entries[0].id = "";
      if (kind === "tenant") data.entries[0].restaurant_id = other;
      if (kind === "currency") data.entries[0].currency = "USD";
      if (kind === "incomplete") data.complete = false;
      if (kind === "cap") data.row_count = 50001;
      await expect(readFinancialSnapshot(async () => data, restaurant)).rejects.toThrow(
        "snapshot unavailable",
      );
    },
  );
  it("rejects another restaurant's envelope", async () => {
    await expect(readFinancialSnapshot(async () => envelope(0), other)).rejects.toThrow("tenant");
  });
  it("propagates connection and RPC errors without returning an empty statement", async () => {
    await expect(
      readFinancialSnapshot(async () => {
        throw new Error("connection lost");
      }, restaurant),
    ).rejects.toThrow("connection lost");
    await expect(readFinancialSnapshot(async () => null, restaurant)).rejects.toThrow(
      "snapshot unavailable",
    );
  });
  it("filters dates from the same immutable response, including inclusive boundaries", async () => {
    const data = envelope(2);
    data.entries[1].created_at = "2026-11-02T00:00:00Z";
    const snapshot = await readFinancialSnapshot(async () => data, restaurant);
    expect(
      snapshotStatement(snapshot, "2026-11-02T00:00:00Z", "2026-11-02T00:00:00Z"),
    ).toHaveLength(1);
    expect(snapshot.entries).toHaveLength(2);
    expect(() => snapshotStatement(snapshot, "invalid")).toThrow("interval");
  });
});
