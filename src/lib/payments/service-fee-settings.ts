import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ServiceFeePayer } from "@/lib/payments/PricingEngine";

export type { ServiceFeePayer };

export type ServiceFeeSettingsRow = {
  restaurant_id: string;
  service_fee_payer?: string | null;
  service_fee_last_changed_at?: string | null;
  service_fee_change_locked_until?: string | null;
};

export type ServiceFeeSettings = {
  restaurantId: string;
  serviceFeePayer: ServiceFeePayer;
  serviceFeeLastChangedAt: string | null;
  serviceFeeChangeLockedUntil: string | null;
};

export class ServiceFeeSettingsError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ServiceFeeSettingsError";
    this.code = code;
    this.details = details;
  }
}

export function isServiceFeePayer(value: unknown): value is ServiceFeePayer {
  return value === "customer" || value === "restaurant";
}

export function serviceFeePayerOrDefault(value: unknown): ServiceFeePayer {
  return value === "restaurant" ? "restaurant" : "customer";
}

export function settingsFromRow(
  restaurantId: string,
  row?: ServiceFeeSettingsRow | null,
): ServiceFeeSettings {
  return {
    restaurantId,
    serviceFeePayer: serviceFeePayerOrDefault(row?.service_fee_payer),
    serviceFeeLastChangedAt: row?.service_fee_last_changed_at ?? null,
    serviceFeeChangeLockedUntil: row?.service_fee_change_locked_until ?? null,
  };
}

export function applyServiceFeePayerChange(input: {
  current: ServiceFeeSettings;
  next: unknown;
  now: Date;
}): { changed: boolean; settings: ServiceFeeSettings } {
  if (!isServiceFeePayer(input.next)) {
    throw new ServiceFeeSettingsError("service_fee_payer_invalid", "Pagador da taxa invalido");
  }

  if (input.current.serviceFeePayer === input.next) {
    return { changed: false, settings: input.current };
  }

  const lockedUntil = input.current.serviceFeeChangeLockedUntil
    ? new Date(input.current.serviceFeeChangeLockedUntil)
    : null;
  if (lockedUntil && lockedUntil.getTime() > input.now.getTime()) {
    throw new ServiceFeeSettingsError("service_fee_change_locked", "Alteracao bloqueada temporariamente", {
      locked_until: lockedUntil.toISOString(),
    });
  }

  const nextLockedUntil = new Date(input.now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    changed: true,
    settings: {
      restaurantId: input.current.restaurantId,
      serviceFeePayer: input.next,
      serviceFeeLastChangedAt: input.now.toISOString(),
      serviceFeeChangeLockedUntil: nextLockedUntil.toISOString(),
    },
  };
}

export function assertServiceFeeSettingsPermission(input: {
  userId: string;
  restaurantOwnerId: string | null | undefined;
  isAdmin?: boolean | null;
}) {
  if (input.isAdmin) return;
  if (input.restaurantOwnerId && input.restaurantOwnerId === input.userId) return;
  throw new ServiceFeeSettingsError("forbidden", "Sem permissao");
}

const payloadSchema = z.object({
  restaurantId: z.string().uuid(),
});

const updateSchema = payloadSchema.extend({
  serviceFeePayer: z.enum(["customer", "restaurant"]),
});

async function assertCanManageRestaurant(
  supabase: any,
  userId: string,
  restaurantId: string,
) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return;

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!restaurant) throw new ServiceFeeSettingsError("restaurant_not_found", "Restaurante nao encontrado");
  assertServiceFeeSettingsPermission({
    userId,
    restaurantOwnerId: restaurant.owner_id,
    isAdmin: false,
  });
}

export async function loadServiceFeeSettingsByRestaurant(
  supabaseAdmin: any,
  restaurantId: string,
): Promise<ServiceFeeSettings> {
  const { data: row, error } = await supabaseAdmin
    .from("tenant_payment_settings")
    .select("restaurant_id, service_fee_payer, service_fee_last_changed_at, service_fee_change_locked_until")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return settingsFromRow(restaurantId, row);
}

export const getServiceFeeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageRestaurant(context.supabase, context.userId, data.restaurantId);
    return loadServiceFeeSettingsByRestaurant(supabaseAdmin, data.restaurantId);
  });

export const updateServiceFeePayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageRestaurant(context.supabase, context.userId, data.restaurantId);

    const current = await loadServiceFeeSettingsByRestaurant(supabaseAdmin, data.restaurantId);
    const result = applyServiceFeePayerChange({
      current,
      next: data.serviceFeePayer,
      now: new Date(),
    });

    if (!result.changed) return result.settings;

    const payload = {
      restaurant_id: data.restaurantId,
      service_fee_payer: result.settings.serviceFeePayer,
      service_fee_last_changed_at: result.settings.serviceFeeLastChangedAt,
      service_fee_change_locked_until: result.settings.serviceFeeChangeLockedUntil,
    };

    const { error } = await supabaseAdmin
      .from("tenant_payment_settings")
      .upsert(payload, { onConflict: "restaurant_id" });
    if (error) throw new Error(error.message);

    return result.settings;
  });
