import { describe, it, expect, beforeEach } from "vitest";
import {
  createTenantConfigurationService, DEFAULT_CONFIG,
  TenantConfigurationCache, validateGroup,
  type TenantConfigRepository, type ConfigGroup, type GroupPayload,
} from "./index";
import type { VersionRow, VersioningRepository } from "./TenantConfigurationVersioning";
import type { AuditEntry, AuditRepository } from "./TenantAudit";

function makeRepo(): TenantConfigRepository & { data: Map<string, any>; version: number } {
  const data = new Map<string, any>();
  return {
    data, version: 1,
    async loadAll(id) { return data.get(id) ?? {}; },
    async saveGroup(id, group, value) {
      const prev = data.get(id) ?? {};
      data.set(id, { ...prev, [group]: value });
    },
    async bumpVersion(id) {
      const prev = data.get(id) ?? {};
      const v = (prev.configuration_version ?? 1) + 1;
      data.set(id, { ...prev, configuration_version: v });
      return v;
    },
  };
}

function makeVersioningRepo(): VersioningRepository & { rows: VersionRow[] } {
  const rows: VersionRow[] = [];
  return {
    rows,
    async append(row) {
      const full = { ...row, created_at: new Date().toISOString() } as VersionRow;
      rows.push(full);
      return full as any;
    },
    async latest(rid, group) {
      const filtered = rows.filter((r) => r.restaurant_id === rid && r.group_name === group);
      return (filtered[filtered.length - 1] as any) ?? null;
    },
    async history(rid, group, limit = 20) {
      return rows.filter((r) => r.restaurant_id === rid && r.group_name === group).slice(-limit) as any;
    },
    async at(rid, group, version) {
      return (rows.find((r) => r.restaurant_id === rid && r.group_name === group && r.version === version) as any) ?? null;
    },
  };
}

function makeAuditRepo(): AuditRepository & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return { entries, async insert(e) { entries.push(e); } };
}

const RID = "r-1";

describe("TenantConfigurationValidator", () => {
  it("valid payment settings pass", () => {
    const r = validateGroup("payment", DEFAULT_CONFIG.payment);
    expect(r.valid).toBe(true);
  });
  it("invalid gateway fails", () => {
    const r = validateGroup("payment", { ...DEFAULT_CONFIG.payment, default_gateway: "xyz" });
    expect(r.valid).toBe(false);
    expect(r.issues[0].field).toBe("default_gateway");
  });
  it("free delivery requires minimum", () => {
    const r = validateGroup("payment", { ...DEFAULT_CONFIG.payment, free_delivery_enabled: true, free_delivery_minimum: null });
    expect(r.valid).toBe(false);
  });
  it("delivery radius must be positive", () => {
    const r = validateGroup("delivery", { ...DEFAULT_CONFIG.delivery, delivery_radius_km: 0 });
    expect(r.valid).toBe(false);
  });
  it("working hours must be HH:MM", () => {
    const r = validateGroup("business", { ...DEFAULT_CONFIG.business, working_hours_json: { mon: { open: "9", close: "18:00" } } as any });
    expect(r.valid).toBe(false);
  });
  it("branding rejects invalid hex", () => {
    const r = validateGroup("branding", { ...DEFAULT_CONFIG.branding, primary_color: "orange" });
    expect(r.valid).toBe(false);
  });
  it("notifications require channels", () => {
    const r = validateGroup("notifications", { ...DEFAULT_CONFIG.notifications, preferred_channels_json: [] });
    expect(r.valid).toBe(false);
  });
});

describe("TenantConfigurationCache", () => {
  it("caches within TTL and invalidates on demand", () => {
    const cache = new TenantConfigurationCache(50);
    cache.set(RID, { restaurant_id: RID, ...DEFAULT_CONFIG } as any);
    expect(cache.get(RID)).not.toBeNull();
    cache.invalidate(RID);
    expect(cache.get(RID)).toBeNull();
  });
  it("expires after TTL", async () => {
    const cache = new TenantConfigurationCache(5);
    cache.set(RID, { restaurant_id: RID, ...DEFAULT_CONFIG } as any);
    await new Promise((r) => setTimeout(r, 15));
    expect(cache.get(RID)).toBeNull();
  });
});

describe("TenantConfigurationService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let vRepo: ReturnType<typeof makeVersioningRepo>;
  let aRepo: ReturnType<typeof makeAuditRepo>;
  let cache: TenantConfigurationCache;

  beforeEach(() => {
    repo = makeRepo();
    vRepo = makeVersioningRepo();
    aRepo = makeAuditRepo();
    cache = new TenantConfigurationCache(1000);
  });

  it("returns defaults merged with loaded values", async () => {
    const svc = createTenantConfigurationService(repo, { cache });
    const cfg = await svc.get(RID);
    expect(cfg.payment.accept_pix).toBe(true);
    expect(cfg.delivery.delivery_radius_km).toBe(5);
  });

  it("update validates, saves, versions, and audits", async () => {
    const svc = createTenantConfigurationService(repo, { versioningRepo: vRepo, auditRepo: aRepo, cache });
    const next: GroupPayload<"payment"> = { ...DEFAULT_CONFIG.payment, minimum_order: 25 };
    const r = await svc.update(RID, "payment", next, "user-1");
    expect(r.ok).toBe(true);
    expect(vRepo.rows).toHaveLength(1);
    expect(aRepo.entries.some((e) => e.field === "minimum_order")).toBe(true);
  });

  it("rejects invalid update", async () => {
    const svc = createTenantConfigurationService(repo, { cache });
    const r = await svc.update(RID, "delivery", { ...DEFAULT_CONFIG.delivery, delivery_radius_km: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.length).toBeGreaterThan(0);
  });

  it("rollback restores previous snapshot", async () => {
    const svc = createTenantConfigurationService(repo, { versioningRepo: vRepo, auditRepo: aRepo, cache });
    await svc.update(RID, "payment", { ...DEFAULT_CONFIG.payment, minimum_order: 10 });
    await svc.update(RID, "payment", { ...DEFAULT_CONFIG.payment, minimum_order: 40 });
    const r = await svc.rollback(RID, "payment", 1);
    expect(r.ok).toBe(true);
    const cfg = await svc.get(RID);
    expect(cfg.payment.minimum_order).toBe(10);
  });

  it("cache is invalidated after update", async () => {
    const svc = createTenantConfigurationService(repo, { cache });
    await svc.get(RID); // fills cache
    expect(cache.size()).toBe(1);
    await svc.update(RID, "features", { ...DEFAULT_CONFIG.features, cashback_enabled: true });
    expect(cache.size()).toBe(0);
    const cfg = await svc.get(RID);
    expect(cfg.features.cashback_enabled).toBe(true);
  });
});
