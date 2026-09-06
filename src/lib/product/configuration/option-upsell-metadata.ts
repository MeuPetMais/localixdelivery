import type { ProductOption } from "./types";

type JsonRecord = NonNullable<ProductOption["metadata"]>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isOptionUpsellEnabled(option: Pick<ProductOption, "metadata">) {
  return option.metadata?.upsell_enabled === true;
}

export function optionUpsellPriority(option: Pick<ProductOption, "metadata">) {
  const priority = option.metadata?.upsell_priority;
  return typeof priority === "number" && Number.isInteger(priority) && priority >= 1
    ? priority
    : null;
}

export function mergeOptionUpsellMetadata(
  metadata: ProductOption["metadata"] | null | undefined,
  patch: { upsell_enabled?: boolean; upsell_priority?: number | null },
): JsonRecord {
  const next: JsonRecord = isRecord(metadata) ? { ...metadata } : {};

  if (patch.upsell_enabled !== undefined) {
    next.upsell_enabled = patch.upsell_enabled;
  }

  if (patch.upsell_priority === null) {
    delete next.upsell_priority;
  } else if (patch.upsell_priority !== undefined) {
    next.upsell_priority = patch.upsell_priority;
  }

  return next;
}
