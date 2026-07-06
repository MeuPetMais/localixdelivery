// RevenueSettingsService — carrega e cacheia a política vigente.
//
// Fonte única: tabela `platform_settings` (singleton, id=true).
// Nenhum outro módulo pode ler taxas hardcoded — deve chamar aqui.

import { supabase } from "@/integrations/supabase/client";
import type { RevenuePolicy } from "./types";

export const DEFAULT_POLICY: RevenuePolicy = {
  service_fee_enabled: true,
  service_fee_type: "TIERED",
  service_fee_value: 0.99,
  tiers: [
    { upTo: 30, value: 0.99 },
    { upTo: null, value: 1.49 },
  ],
  currency: "BRL",
  effective_from: null,
  effective_until: null,
  active: true,
};

let cache: { at: number; value: RevenuePolicy } | null = null;
const TTL = 60_000;

export const RevenueSettingsService = {
  async load(force = false): Promise<RevenuePolicy> {
    if (!force && cache && Date.now() - cache.at < TTL) return cache.value;
    const { data } = await supabase
      .from("platform_settings" as any)
      .select(
        "platform_fee_until_30, platform_fee_above_30, currency, service_fee_enabled, service_fee_type, service_fee_value, effective_from, effective_until",
      )
      .eq("id", true)
      .maybeSingle();

    const row = (data ?? {}) as Record<string, unknown>;
    const untilFee = Number(row.platform_fee_until_30 ?? DEFAULT_POLICY.tiers![0].value);
    const aboveFee = Number(row.platform_fee_above_30 ?? DEFAULT_POLICY.tiers![1].value);

    const policy: RevenuePolicy = {
      service_fee_enabled: (row.service_fee_enabled as boolean) ?? DEFAULT_POLICY.service_fee_enabled,
      service_fee_type: ((row.service_fee_type as RevenuePolicy["service_fee_type"]) ?? "TIERED"),
      service_fee_value: Number(row.service_fee_value ?? untilFee),
      tiers: [
        { upTo: 30, value: untilFee },
        { upTo: null, value: aboveFee },
      ],
      currency: (row.currency as string) ?? DEFAULT_POLICY.currency,
      effective_from: (row.effective_from as string) ?? null,
      effective_until: (row.effective_until as string) ?? null,
      active: true,
    };
    cache = { at: Date.now(), value: policy };
    return policy;
  },
  clearCache() { cache = null; },
};
