import type { CatalogAvailabilityContext, CatalogAvailabilityResult, CatalogMenu } from "./types";

/**
 * CatalogAvailabilityService — pure resolver: can this menu be served now?
 * Combines status, channel, weekday, time-of-day and optional stock signal.
 */
export const CatalogAvailabilityService = {
  resolve(menu: CatalogMenu, ctx: CatalogAvailabilityContext = {}): CatalogAvailabilityResult {
    const reasons: string[] = [];
    const now = ctx.now ?? new Date();

    if (menu.status === "archived") reasons.push("menu:archived");
    if (menu.status === "draft") reasons.push("menu:draft");
    if (menu.status === "scheduled") reasons.push("menu:scheduled");

    if (ctx.channel && menu.channel !== ctx.channel) reasons.push(`channel:${menu.channel}!=${ctx.channel}`);
    if (ctx.stockAvailable === false) reasons.push("stock:out");

    if (menu.available_days && menu.available_days.length > 0) {
      if (!menu.available_days.includes(now.getDay())) reasons.push("schedule:weekday");
    }
    if (menu.available_start_time && menu.available_end_time) {
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm < menu.available_start_time || hhmm > menu.available_end_time) {
        reasons.push("schedule:time");
      }
    }

    return { available: reasons.length === 0, reasons };
  },
} as const;
