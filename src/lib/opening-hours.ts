import { record } from "./json";
import type { OpeningHours, DayHours } from "./restaurant-status";
export function parseOpeningHours(value: unknown): OpeningHours {
  if (value == null) return value;
  const result: Record<string, DayHours> = {};
  for (const [day, raw] of Object.entries(record(value))) {
    if (!raw) continue; // Legacy null/false means no configured day, as in the storefront.
    const hours = record(raw);
    result[day] = {
      enabled: typeof hours.enabled === "boolean" ? hours.enabled : undefined,
      ...Object.fromEntries(
        ["open", "close", "open2", "close2"].map((k) => [
          k,
          typeof hours[k] === "string" ? hours[k] : null,
        ]),
      ),
    };
  }
  return result;
}
