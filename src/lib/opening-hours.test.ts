import { describe, expect, it } from "vitest";
import { parseOpeningHours } from "./opening-hours";
import { getRestaurantStatus, type OpeningHours } from "./restaurant-status";

describe("WhatsApp/storefront opening-hours compatibility", () => {
  it.each([null, false])("preserves the unconfigured legacy day %s", (mon) => {
    const parsed = parseOpeningHours({ mon });
    expect(
      getRestaurantStatus({ opening_hours: parsed }, new Date("2026-11-09T15:00:00Z")).isOpen,
    ).toBe(true);
  });
  it.each<OpeningHours>([
    {},
    null,
    { mon: { enabled: false } },
    { mon: { open: "09:00", close: "18:00" } },
    { sun: { open: "22:00", close: "02:00" }, mon: { enabled: false } },
    { mon: { open: "bad", close: "18:00" } },
  ])("matches storefront status across times and manual closures: %j", (hours) => {
    for (const time of ["2026-11-09T03:30:00Z", "2026-11-09T15:00:00Z", "2026-11-10T00:00:00Z"]) {
      for (const is_open of [true, false, null]) {
        const now = new Date(time);
        expect(
          getRestaurantStatus({ is_open, opening_hours: parseOpeningHours(hours) }, now),
        ).toEqual(getRestaurantStatus({ is_open, opening_hours: hours }, now));
      }
    }
  });
});
