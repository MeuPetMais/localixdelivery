import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { jsonObject, toJson } from "@/lib/json";
export type BenefitType =
  | "FREE_PRODUCT"
  | "DISCOUNT"
  | "FREE_DELIVERY"
  | "CASHBACK"
  | "COUPON"
  | "GIFT";

export type TriggerKind = "POINTS" | "ORDERS" | "PRODUCTS" | "SPENT";

const numeric = z.union([
  z.number().finite(),
  z.string().refine((v) => v.trim() !== "" && Number.isFinite(Number(v))),
]);
const benefitConfigSchema = z
  .object({
    ui_kind: z.enum(["FREE_PRODUCT", "DISCOUNT", "FREE_DELIVERY", "CASHBACK", "COUPON", "GIFT"]),
    trigger: z
      .object({
        kind: z.enum(["POINTS", "ORDERS", "PRODUCTS", "SPENT"]),
        qty: numeric,
        product_name: z.string().optional(),
      })
      .passthrough(),
    reward: z
      .object({
        product_name: z.string().optional(),
        discount_percent: numeric.optional(),
        cashback_amount: numeric.optional(),
        coupon_code: z.string().optional(),
        gift_note: z.string().optional(),
      })
      .passthrough(),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
  })
  .passthrough();
export type BenefitConfig = z.infer<typeof benefitConfigSchema>;
export function readBenefitConfig(value: Json): BenefitConfig {
  const parsed = benefitConfigSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : {
        ...jsonObject(value),
        ui_kind: "DISCOUNT",
        trigger: { kind: "POINTS", qty: 0 },
        reward: {},
      };
}

/** Merge against the stored JSON so unrelated legacy engine settings survive UI edits. */
export function persistBenefitConfig(original: Json, edited: BenefitConfig): Json {
  if (original !== null && !benefitConfigSchema.safeParse(original).success)
    throw new Error(
      "Configuração legada incompatível: edição bloqueada para preservar os dados existentes.",
    );
  const previous = jsonObject(original);
  return toJson({
    ...previous,
    ...edited,
    trigger: { ...jsonObject(previous.trigger), ...edited.trigger },
    reward: { ...jsonObject(previous.reward), ...edited.reward },
    starts_at: edited.starts_at || null,
    ends_at: edited.ends_at || null,
  });
}

export function benefitMutationPayload(
  restaurantId: string,
  name: string,
  edited: BenefitConfig,
  original: { config: Json; rule_type: string; active: boolean; priority: number } | null,
) {
  return {
    restaurant_id: restaurantId,
    name: name.trim(),
    rule_type:
      original && edited.ui_kind === readBenefitConfig(original.config).ui_kind
        ? original.rule_type
        : edited.ui_kind,
    config: persistBenefitConfig(original?.config ?? null, edited),
    active: original?.active ?? true,
    starts_at: edited.starts_at || null,
    ends_at: edited.ends_at || null,
    priority: original?.priority ?? 10,
  };
}
