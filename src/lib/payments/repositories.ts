// Repositórios de acesso ao banco para o módulo de pagamentos.
// Camada fina sobre o client Supabase — sem regra de negócio.

import { supabase } from "@/integrations/supabase/client";
import type {
  MercadoPagoAccount,
  Payment,
  PaymentLog,
  PlatformFees,
} from "./types";

// ------- Mercado Pago accounts -------
export const mpAccountRepo = {
  async getByRestaurant(restaurantId: string) {
    const { data, error } = await supabase
      .from("mercado_pago_accounts" as any)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as MercadoPagoAccount | null) ?? null;
  },
  async upsert(payload: Partial<MercadoPagoAccount> & { restaurant_id: string }) {
    const { data, error } = await supabase
      .from("mercado_pago_accounts" as any)
      .upsert(payload, { onConflict: "restaurant_id" })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as MercadoPagoAccount;
  },
  async disconnect(restaurantId: string) {
    const { error } = await supabase
      .from("mercado_pago_accounts" as any)
      .update({
        connected: false,
        access_token: null,
        refresh_token: null,
        disconnected_at: new Date().toISOString(),
      })
      .eq("restaurant_id", restaurantId);
    if (error) throw error;
  },
};

// ------- Payments -------
export const paymentsRepo = {
  async create(payload: Partial<Payment> & { restaurant_id: string; method: string; amount: number }) {
    const { data, error } = await supabase
      .from("payments" as any)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Payment;
  },
  async getById(id: string) {
    const { data, error } = await supabase
      .from("payments" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as Payment | null) ?? null;
  },
  async listByRestaurant(restaurantId: string, limit = 100) {
    const { data, error } = await supabase
      .from("payments" as any)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as Payment[];
  },
  async updateStatus(id: string, patch: Partial<Payment>) {
    const { data, error } = await supabase
      .from("payments" as any)
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as Payment;
  },
};

// ------- Platform fees -------
export const platformFeesRepo = {
  async get(): Promise<PlatformFees | null> {
    const { data, error } = await supabase
      .from("platform_fees" as any)
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as PlatformFees | null) ?? null;
  },
  async update(patch: Partial<PlatformFees>) {
    const { data, error } = await supabase
      .from("platform_fees" as any)
      .update(patch)
      .eq("id", true)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as PlatformFees;
  },
};

// ------- Payment logs -------
export const paymentLogsRepo = {
  async add(entry: Omit<PaymentLog, "id" | "created_at">) {
    const { error } = await supabase.from("payment_logs" as any).insert(entry);
    if (error) throw error;
  },
  async listByPayment(paymentId: string) {
    const { data, error } = await supabase
      .from("payment_logs" as any)
      .select("*")
      .eq("payment_id", paymentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as PaymentLog[];
  },
};
