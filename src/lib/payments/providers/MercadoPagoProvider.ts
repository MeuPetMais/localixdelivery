// Provider do Mercado Pago.
// Toda comunicação com o MP acontece dentro de Edge Functions.
// Este módulo apenas invoca as funções `mp-oauth` via supabase.functions.invoke.

import { supabase } from "@/integrations/supabase/client";
import type {
  ConnectionStatus,
  OAuthStartResult,
  PaymentProvider,
} from "./PaymentProvider";

async function invoke<T>(action: string, restaurantId: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("mp-oauth", {
    body: { restaurant_id: restaurantId, ...extra },
    // action vai por query string
    // (supabase-js concatena o path se prefixado com "?")
    // fallback: usamos header também
    headers: { "x-action": action },
    method: "POST",
    ...({ query: { action } } as any),
  });
  if (error) throw error;
  return data as T;
}

export const MercadoPagoProvider: PaymentProvider = {
  id: "mercado_pago",
  label: "Mercado Pago",
  supportsOAuth: true,

  async startOAuth(restaurantId, redirectTo) {
    const { data, error } = await supabase.functions.invoke(
      `mp-oauth?action=start`,
      {
        body: { restaurant_id: restaurantId, redirect_to: redirectTo },
      },
    );
    if (error) throw error;
    return { authorizeUrl: (data as any).authorize_url } as OAuthStartResult;
  },

  async getStatus(restaurantId) {
    const { data, error } = await supabase.functions.invoke(
      `mp-oauth?action=status`,
      { body: { restaurant_id: restaurantId } },
    );
    if (error) throw error;
    const d = data as any;
    return {
      provider: "mercado_pago",
      connected: !!d.connected,
      accountId: d.mp_user_id ?? null,
      liveMode: !!d.live_mode,
      scope: d.scope ?? null,
      connectedAt: d.connected_at ?? null,
      disconnectedAt: d.disconnected_at ?? null,
      expiresAt: d.expires_at ?? null,
      publicKey: d.public_key ?? null,
    } satisfies ConnectionStatus;
  },

  async disconnect(restaurantId) {
    const { error } = await supabase.functions.invoke(
      `mp-oauth?action=disconnect`,
      { body: { restaurant_id: restaurantId } },
    );
    if (error) throw error;
  },
};
