import { describe, it, expect } from "vitest";
import { rangeBounds, filterHistory, summarize, toCsv, type HistoryItem } from "./driver-wallet-filters";

const REF = new Date("2025-06-15T15:00:00");

const items: HistoryItem[] = [
  { id: "1", status: "ENTREGUE", delivered_at: "2025-06-15T10:00:00", earnings: 10 },
  { id: "2", status: "ENTREGUE", delivered_at: "2025-06-14T10:00:00", earnings: 20 },
  { id: "3", status: "ENTREGUE", delivered_at: "2025-06-01T10:00:00", earnings: 30 },
  { id: "4", status: "CANCELADO", delivered_at: "2025-06-15T09:00:00", earnings: 0 },
  { id: "5", status: "ENTREGUE", delivered_at: "2025-05-20T10:00:00", earnings: 40 },
];

describe("rangeBounds", () => {
  it("today = only today", () => {
    const { from, to } = rangeBounds("today", undefined, REF);
    expect(from.toISOString().slice(0, 10)).toBe("2025-06-15");
    expect(to.getHours()).toBe(23);
  });
  it("week = current ISO week", () => {
    const { from } = rangeBounds("week", undefined, REF);
    expect(from.getDay()).toBe(1); // Monday
  });
  it("month = first day", () => {
    const { from } = rangeBounds("month", undefined, REF);
    expect(from.getDate()).toBe(1);
  });
  it("custom respects from/to", () => {
    const { from, to } = rangeBounds("custom", { from: "2025-06-10", to: "2025-06-14" }, REF);
    expect(from.toISOString().slice(0, 10)).toBe("2025-06-10");
    expect(to.toISOString().slice(0, 10)).toBe("2025-06-14");
  });
});

describe("filterHistory", () => {
  it("today", () => {
    const f = filterHistory(items, "today", undefined, REF);
    expect(f.map((i) => i.id).sort()).toEqual(["1", "4"]);
  });
  it("month", () => {
    const f = filterHistory(items, "month", undefined, REF);
    expect(f.map((i) => i.id).sort()).toEqual(["1", "2", "3", "4"]);
  });
  it("custom range", () => {
    const f = filterHistory(items, "custom", { from: "2025-05-01", to: "2025-05-31" }, REF);
    expect(f.map((i) => i.id)).toEqual(["5"]);
  });
});

describe("summarize", () => {
  it("ignores CANCELADO in totals", () => {
    const s = summarize(items);
    expect(s.total).toBe(100);
    expect(s.count).toBe(4);
    expect(s.ticket).toBe(25);
  });
});

describe("toCsv", () => {
  it("has header and rows", () => {
    const csv = toCsv(items.slice(0, 2));
    expect(csv.split("\n")[0]).toBe("data,pedido,cliente,status,valor");
    expect(csv.split("\n")).toHaveLength(3);
  });
});
