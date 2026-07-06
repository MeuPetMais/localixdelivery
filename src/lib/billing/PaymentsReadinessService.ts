// Billing Domain — Payments Readiness (leitura).
// Responde se um restaurante está apto a receber pagamentos com base
// EXCLUSIVAMENTE nos campos stripe_* de public.restaurants.
//
// Regras: apenas leitura. Não altera nenhuma outra regra do Billing.

import { supabase } from "@/integrations/supabase/client";

export type ReadinessReason =
  | "no_account"
  | "onboarding_incomplete"
  | "capabilities_inactive"
  | "account_under_review";

export interface PaymentsReadiness {
  ready: boolean;
  reasons: ReadinessReason[];
  status: string;
  accountId: string | null;
}

export const PaymentsReadinessService = {
  async isReadyForPayments(restaurantId: string): Promise<PaymentsReadiness> {
    const { data, error } = await supabase
      .from("restaurants")
      .select(
        "stripe_account_id, stripe_account_status, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_onboarding_completed",
      )
      .eq("id", restaurantId)
      .maybeSingle();

    if (error || !data) {
      return {
        ready: false,
        reasons: ["no_account"],
        status: "not_created",
        accountId: null,
      };
    }

    const reasons: ReadinessReason[] = [];
    if (!data.stripe_account_id) reasons.push("no_account");
    if (data.stripe_account_id && !data.stripe_details_submitted)
      reasons.push("onboarding_incomplete");
    if (
      data.stripe_account_id &&
      (!data.stripe_charges_enabled || !data.stripe_payouts_enabled)
    )
      reasons.push("capabilities_inactive");
    if (data.stripe_account_status === "restricted") reasons.push("account_under_review");

    return {
      ready:
        !!data.stripe_account_id &&
        !!data.stripe_charges_enabled &&
        !!data.stripe_payouts_enabled &&
        !!data.stripe_details_submitted &&
        data.stripe_account_status === "active",
      reasons,
      status: data.stripe_account_status ?? "not_created",
      accountId: data.stripe_account_id ?? null,
    };
  },
};

export default PaymentsReadinessService;
