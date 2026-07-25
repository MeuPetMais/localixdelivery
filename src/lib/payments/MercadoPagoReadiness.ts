import { supabase } from "@/integrations/supabase/client";

export type MercadoPagoReadinessReason =
  | "not_connected"
  | "disconnected"
  | "invalid_account";

export interface MercadoPagoReadiness {
  ready: boolean;
  provider: "mercado_pago";
  connected: boolean;
  accountId: string | null;
  methods: ("pix" | "credit_card")[];
  reasons: MercadoPagoReadinessReason[];
}

export const MercadoPagoReadiness = {
  async get(restaurantId: string): Promise<MercadoPagoReadiness> {
    const { data, error } = await supabase
      .from("mercado_pago_accounts")
      .select(
        `
        mp_user_id,
        connected,
        live_mode,
        disconnected_at
      `,
      )
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (error || !data) {
      return {
        provider: "mercado_pago",
        ready: false,
        connected: false,
        accountId: null,
        methods: [],
        reasons: ["not_connected"],
      };
    }

    if (!data.connected) {
      return {
        provider: "mercado_pago",
        ready: false,
        connected: false,
        accountId: data.mp_user_id ?? null,
        methods: [],
        reasons: ["disconnected"],
      };
    }

    return {
      provider: "mercado_pago",
      ready: true,
      connected: true,
      accountId: data.mp_user_id ?? null,
      methods: ["pix", "credit_card"],
      reasons: [],
    };
  },
};

export default MercadoPagoReadiness;