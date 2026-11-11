import { describe, expect, it } from "vitest";
import { collectFinancialStatement } from "./financial-statement-pagination";

function pagedSource(total: number) {
  const source = Array.from({ length: total }, (_, index) => ({
    id: `ledger-${index}`,
    amount: 1,
  }));
  const ranges: Array<[number, number]> = [];
  return {
    ranges,
    fetch: async (start: number, end: number) => {
      ranges.push([start, end]);
      return source.slice(start, end + 1);
    },
  };
}

describe("complete financial statement collector", () => {
  it("retrieves all rows beyond the previous 500-row UI limit without double counting", async () => {
    const source = pagedSource(1_201);
    const rows = await collectFinancialStatement(source.fetch);
    expect(rows).toHaveLength(1_201);
    expect(new Set(rows.map((row) => row.id)).size).toBe(1_201);
    expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(1_201);
    expect(source.ranges).toEqual([
      [0, 499],
      [500, 999],
      [1_000, 1_499],
    ]);
  });

  it("handles an exact multiple of the page size with a final empty probe", async () => {
    const source = pagedSource(1_000);
    const rows = await collectFinancialStatement(source.fetch);
    expect(rows).toHaveLength(1_000);
    expect(source.ranges).toEqual([
      [0, 499],
      [500, 999],
      [1_000, 1_499],
    ]);
  });

  it("allows an empty statement", async () => {
    const source = pagedSource(0);
    expect(await collectFinancialStatement(source.fetch)).toEqual([]);
  });

  it("fails closed instead of returning a partial aggregate above the safety cap", async () => {
    const source = pagedSource(1_001);
    await expect(collectFinancialStatement(source.fetch, { maxRows: 1_000 })).rejects.toThrow(
      "limite seguro de processamento",
    );
    expect(source.ranges).toHaveLength(3);
  });

  it("propagates a failed page rather than returning a partial statement", async () => {
    await expect(
      collectFinancialStatement(async (start) => {
        if (start >= 500) throw new Error("remote page failure");
        return Array.from({ length: 500 }, (_, index) => index);
      }),
    ).rejects.toThrow("remote page failure");
  });

  it("rejects invalid page sizes and oversized responses", async () => {
    await expect(collectFinancialStatement(async () => [], { pageSize: 0 })).rejects.toThrow(
      "Configuração inválida",
    );
    await expect(collectFinancialStatement(async () => [1, 2, 3], { pageSize: 2 })).rejects.toThrow(
      "página maior",
    );
  });
});
