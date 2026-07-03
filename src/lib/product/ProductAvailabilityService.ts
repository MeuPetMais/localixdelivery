import type { ProductAvailabilityContext, ProductAvailabilityResult, ProductRecord } from "./types";
import { ProductLifecycle } from "./ProductLifecycle";

/**
 * ProductAvailabilityService — pure resolver.
 * Combines lifecycle state + recurrence window + channel + optional stock
 * signal (fed by Inventory Domain) to answer "can this be sold right now?".
 */
export const ProductAvailabilityService = {
  resolve(product: ProductRecord, ctx: ProductAvailabilityContext = {}): ProductAvailabilityResult {
    const reasons: string[] = [];
    const now = ctx.now ?? new Date();

    const status = ProductLifecycle.fromRecord(product);
    if (status === "ARCHIVED" || status === "DISCONTINUED") reasons.push(`lifecycle:${status}`);
    if (status === "PAUSED") reasons.push("lifecycle:PAUSED");
    if (status === "SCHEDULED") reasons.push("lifecycle:SCHEDULED");
    if (!product.is_available) reasons.push("flag:is_available=false");

    // Channel
    if (ctx.channel === "delivery" && product.available_delivery === false) reasons.push("channel:delivery_disabled");
    if (ctx.channel === "pickup" && product.available_pickup === false) reasons.push("channel:pickup_disabled");

    // Stock
    if (ctx.stockAvailable === false) reasons.push("stock:out");

    // Recurrence window (weekday + time-of-day)
    if (product.recurrence_days && product.recurrence_days.length > 0) {
      if (!product.recurrence_days.includes(now.getDay())) reasons.push("schedule:weekday");
    }
    if (product.recurrence_start_time && product.recurrence_end_time) {
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm < product.recurrence_start_time || hhmm > product.recurrence_end_time) {
        reasons.push("schedule:time");
      }
    }

    return { available: reasons.length === 0, reasons };
  },
} as const;
