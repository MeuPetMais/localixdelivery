import { z } from "zod";
const selection = z
  .object({
    group_id: z.string().optional(),
    group_name: z.string().optional(),
    option_id: z.string().optional(),
    option_name: z.string().optional(),
    name: z.string().optional(),
    qty: z.number().optional(),
    price: z.number().optional(),
  })
  .passthrough();
const addon = z
  .object({
    groupId: z.string().optional(),
    groupName: z.string().optional(),
    optionId: z.string().optional(),
    name: z.string().optional(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    total: z.number().optional(),
  })
  .passthrough();
const itemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    qty: z.coerce.number(),
    price: z.coerce.number(),
    kind: z.enum(["product", "builder"]).optional(),
    builderId: z.string().nullable().optional(),
    selections: z.array(selection).optional(),
    addons: z.array(addon).optional(),
    notes: z.string().nullable().optional(),
    options: z.array(z.string()).nullable().optional(),
    removed: z.array(z.string()).nullable().optional(),
    builderGroups: z.record(z.array(z.string())).nullable().optional(),
    category: z.string().nullable().optional(),
    isBuilder: z.boolean().nullable().optional(),
  })
  .passthrough();
export type StoredOrderItem = z.infer<typeof itemSchema>;
export function parseStoredOrderItems(value: unknown): StoredOrderItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = itemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Transport snapshot consumed by the storefront when repeating an order. */
export function repeatStoredOrderItems(items: StoredOrderItem[]) {
  return items.map((it) => ({
    id: it.id,
    name: it.name,
    price: it.price,
    qty: it.qty,
    kind: it.kind,
    builderId: it.builderId,
    selections: it.selections,
  }));
}
