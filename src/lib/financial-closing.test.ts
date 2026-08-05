import { describe, it, expect } from "vitest";
import {
  aggregateByDriver, earn, periodBounds, toCsv, totals,
  type DeliveredRow,
} from "./financial-closing";

const drivers = [
  { id: "d1", name: "João", photo_url: null },
  { id: "d2", name: "Carlos", photo_url: null },
  { id: "d3", name: "Pedro", photo_url: null },
];

const rows: DeliveredRow[] = [
  { driver_id: "d1", delivered_at: "2026-07-11T10:00:00Z", distance_km: 2, driver_earning_amount: 11, driver_earning_calculated_at: "2026-07-11T10:00:00Z" },
  { driver_id: "d1", delivered_at: "2026-07-11T11:00:00Z", distance_km: 4, driver_earning_amount: 14, driver_earning_calculated_at: "2026-07-11T11:00:00Z" },
  { driver_id: "d2", delivered_at: "2026-07-11T10:00:00Z", distance_km: 0, driver_earning_amount: 8, driver_earning_calculated_at: "2026-07-11T10:00:00Z" },
  { driver_id: null, delivered_at: "2026-07-11T10:00:00Z", distance_km: 5 },
];

describe("financial-closing", () => {
  it("earn usa snapshot persistido", () => {
    expect(earn({
      driver_id: "x",
      delivered_at: null,
      distance_km: 4,
      driver_earning_amount: 99,
      driver_earning_calculated_at: "2026-07-11T10:00:00Z",
    })).toBe(99);
  });

  it("assignment legado usa fallback controlado", () => {
    expect(earn({ driver_id: "x", delivered_at: null, distance_km: 4 })).toBe(14);
    expect(earn({ driver_id: "x", delivered_at: null, distance_km: null })).toBe(8);
  });

  it("aggregateByDriver soma ganhos e ignora null", () => {
    const r = aggregateByDriver(rows, drivers);
    expect(r).toHaveLength(3);
    const joao = r.find((d) => d.driver_id === "d1")!;
    expect(joao.deliveries).toBe(2);
    expect(joao.distance_km).toBe(6);
    expect(joao.earnings).toBe(25);
    const pedro = r.find((d) => d.driver_id === "d3")!;
    expect(pedro.deliveries).toBe(0);
  });

  it("ordena por ganho decrescente", () => {
    const r = aggregateByDriver(rows, drivers);
    expect(r[0].driver_id).toBe("d1");
  });

  it("totals soma tudo", () => {
    const t = totals(aggregateByDriver(rows, drivers));
    expect(t.deliveries).toBe(3);
    expect(t.distance_km).toBe(6);
    expect(t.earnings).toBe(33);
  });

  it("periodBounds hoje cobre 24h", () => {
    const ref = new Date("2026-07-11T15:30:00");
    const { from, to } = periodBounds("today", { ref });
    expect(from.getHours()).toBe(0);
    expect(to.getDate()).toBe(12);
  });

  it("periodBounds mês", () => {
    const ref = new Date("2026-07-11T00:00:00");
    const { from, to } = periodBounds("month", { ref });
    expect(from.getMonth()).toBe(6);
    expect(to.getMonth()).toBe(7);
  });

  it("periodBounds custom usa from/to", () => {
    const { from, to } = periodBounds("custom", {
      from: "2026-01-01", to: "2026-02-01",
    });
    expect(from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(to.toISOString().slice(0, 10)).toBe("2026-02-01");
  });

  it("toCsv gera cabeçalho e linha TOTAL", () => {
    const csv = toCsv(aggregateByDriver(rows, drivers));
    expect(csv.split("\n")[0]).toContain("Entregador");
    expect(csv).toContain("TOTAL");
  });
});
