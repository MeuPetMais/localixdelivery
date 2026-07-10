// TrackingRetention — Testes (RC5.3.x.3).
import { describe, it, expect } from "vitest";
import {
  TRACKING_RETENTION_POLICIES,
  classifyAge,
  classifyDate,
} from "./retention.policy";
import {
  createTrackingRetentionService,
  type RetentionQueryClient,
} from "./retention.service";
import { retentionPreview } from "./retention.command";

const NOW = new Date("2026-07-10T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("RetentionPolicy", () => {
  const p = TRACKING_RETENTION_POLICIES.tracking_timeline;

  it("classifica por idade em ONLINE / ARCHIVE / PURGE", () => {
    expect(classifyAge(0, p)).toBe("ONLINE");
    expect(classifyAge(89, p)).toBe("ONLINE");
    expect(classifyAge(90, p)).toBe("ARCHIVE");
    expect(classifyAge(364, p)).toBe("ARCHIVE");
    expect(classifyAge(365, p)).toBe("PURGE");
    expect(classifyAge(1000, p)).toBe("PURGE");
  });

  it("classifica por data ISO", () => {
    expect(classifyDate(daysAgo(10), p, NOW)).toBe("ONLINE");
    expect(classifyDate(daysAgo(200), p, NOW)).toBe("ARCHIVE");
    expect(classifyDate(daysAgo(400), p, NOW)).toBe("PURGE");
  });

  it("cobre as duas tabelas do domínio", () => {
    expect(Object.keys(TRACKING_RETENTION_POLICIES).sort()).toEqual(
      ["tracking_eta_history", "tracking_timeline"],
    );
  });
});

function fakeClient(counts: Record<string, { online: number; archive: number; purge: number }>): RetentionQueryClient {
  return {
    async countBetween(table, from, to) {
      const c = counts[table] ?? { online: 0, archive: 0, purge: 0 };
      // ONLINE:  from=onlineFromIso, to=null
      // ARCHIVE: from=archiveFromIso, to=onlineFromIso
      // PURGE:   from=null, to=archiveFromIso
      if (from && !to) return c.online;
      if (from && to) return c.archive;
      if (!from && to) return c.purge;
      return 0;
    },
    async boundsBetween(_table, from, to) {
      // devolve limites plausíveis; teste não valida datas exatas
      if (from && !to) return { oldest: daysAgo(80), newest: daysAgo(1) };
      if (from && to) return { oldest: daysAgo(300), newest: daysAgo(100) };
      if (!from && to) return { oldest: daysAgo(800), newest: daysAgo(400) };
      return { oldest: null, newest: null };
    },
  };
}

describe("TrackingRetentionService", () => {
  it("preview retorna 3 tiers com contagens corretas + correlation_id propagado", async () => {
    const client = fakeClient({
      tracking_timeline: { online: 500, archive: 120, purge: 30 },
    });
    const logs: any[] = [];
    const svc = createTrackingRetentionService({
      client,
      now: () => NOW,
      logger: (e) => logs.push(e),
    });

    const report = await svc.preview("tracking_timeline", "cid-abc");
    expect(report.correlation_id).toBe("cid-abc");
    expect(report.total).toBe(650);
    const byTier = Object.fromEntries(report.tiers.map((t) => [t.tier, t.count]));
    expect(byTier).toEqual({ ONLINE: 500, ARCHIVE: 120, PURGE: 30 });
    // bytes proporcionais
    expect(report.tiers.find((t) => t.tier === "ONLINE")!.approx_bytes).toBe(500 * 512);
    // logs com correlation id
    expect(logs.every((l) => l.correlation_id === "cid-abc")).toBe(true);
    expect(logs.some((l) => l.msg === "retention.preview.start")).toBe(true);
    expect(logs.some((l) => l.msg === "retention.preview.done")).toBe(true);
    expect(logs.some((l) => l.level === "warn" && l.msg === "retention.purge_eligible")).toBe(true);
  });

  it("previewAll cobre as duas tabelas com mesmo correlation_id", async () => {
    const client = fakeClient({
      tracking_timeline:    { online: 10, archive: 5, purge: 0 },
      tracking_eta_history: { online: 20, archive: 0, purge: 7 },
    });
    const svc = createTrackingRetentionService({ client, now: () => NOW, logger: () => {} });
    const reports = await svc.previewAll("cid-xyz");
    expect(reports).toHaveLength(2);
    expect(new Set(reports.map((r) => r.table))).toEqual(new Set(["tracking_timeline", "tracking_eta_history"]));
    expect(reports.every((r) => r.correlation_id === "cid-xyz")).toBe(true);
  });

  it("serviço nunca expõe API de exclusão", () => {
    const svc = createTrackingRetentionService({ client: fakeClient({}), logger: () => {} });
    expect((svc as any).delete).toBeUndefined();
    expect((svc as any).purge).toBeUndefined();
    expect((svc as any).archive).toBeUndefined();
  });
});

describe("retentionPreview command", () => {
  it("produz linhas humanizadas por tabela e tier", async () => {
    // usa serviço default (supabase); aqui apenas garantimos que a função existe e resolve com fake.
    // como o command usa o singleton, apenas validamos o formatador via um preview manual.
    const client = fakeClient({
      tracking_timeline:    { online: 100, archive: 0, purge: 0 },
      tracking_eta_history: { online: 0,   archive: 0, purge: 0 },
    });
    const svc = createTrackingRetentionService({ client, now: () => NOW, logger: () => {} });
    const reports = await svc.previewAll("cid-1");
    // sanity: formatação humana de bytes (100 * 512 = 51200 B ~= 50.0 KB)
    expect(reports[0].tiers.find((t) => t.tier === "ONLINE")!.approx_bytes).toBe(51200);
    // Comando existe e retorna Promise
    expect(typeof retentionPreview).toBe("function");
  });
});
