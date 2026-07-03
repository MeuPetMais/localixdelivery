// Recursos por plano — camada aditiva sobre PlanCatalogService.
// Não altera o catálogo determinístico; aplica overrides versionados.

import type { PlanTier } from "@/lib/platform/types";
import { PlanCatalogService } from "@/lib/platform/PlanCatalogService";

export interface PlanOverrides {
  plan: PlanTier;
  features?: string[];
  restrictions?: string[];
  version: number;
  updated_at: string;
  updated_by: string;
}

export interface PlanFeatureRepository {
  get(plan: PlanTier): PlanOverrides | undefined;
  save(overrides: PlanOverrides): void;
  list(): PlanOverrides[];
}

export class InMemoryPlanFeatureRepository implements PlanFeatureRepository {
  private map = new Map<PlanTier, PlanOverrides>();
  get(p: PlanTier) { return this.map.get(p); }
  save(o: PlanOverrides) { this.map.set(o.plan, o); }
  list() { return [...this.map.values()]; }
}

export class PlanFeatureService {
  constructor(private readonly repo: PlanFeatureRepository = new InMemoryPlanFeatureRepository()) {}

  resolve(plan: PlanTier): { features: string[]; restrictions: string[] } {
    const base = PlanCatalogService.get(plan);
    const overrides = this.repo.get(plan);
    return {
      features: overrides?.features ?? base.features,
      restrictions: overrides?.restrictions ?? base.restrictions,
    };
  }

  hasFeature(plan: PlanTier, feature: string): boolean {
    return this.resolve(plan).features.includes(feature);
  }

  updateFeatures(input: {
    plan: PlanTier; features?: string[]; restrictions?: string[]; actorId: string;
  }): PlanOverrides {
    const current = this.repo.get(input.plan);
    const next: PlanOverrides = {
      plan: input.plan,
      features: input.features ?? current?.features,
      restrictions: input.restrictions ?? current?.restrictions,
      version: (current?.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
      updated_by: input.actorId,
    };
    this.repo.save(next);
    return next;
  }
}
