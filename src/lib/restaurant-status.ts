// Single source of truth for restaurant open/closed status.
// Rule:
//  1. If the owner has manually closed (is_open === false) → always Closed.
//  2. Otherwise check opening_hours using the restaurant business timezone.
//     - No schedule at all → treat as Open (owner hasn't configured hours).
//     - Day disabled or outside shifts → Closed.
//     - Inside shift 1 or shift 2 → Open.
//
// Important: never use the browser/device timezone implicitly here. Public pages
// can be opened by customers outside Brazil, while the dashboard can be opened on
// another device. Using one fixed timezone keeps Dashboard and storefront in sync.

export type DayHours = {
  enabled?: boolean;
  open?: string | null;
  close?: string | null;
  open2?: string | null;
  close2?: string | null;
};

export type OpeningHours = Record<string, DayHours> | null | undefined;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEK_MINUTES = 7 * 24 * 60;
export const DEFAULT_RESTAURANT_TIME_ZONE = "America/Sao_Paulo";

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) return null;
  if (h === 24 && m === 0) return 24 * 60;
  if (h < 0 || h > 23) return null;
  return h * 60 + m;
}

function getZonedNow(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    const weekday = (get("weekday") ?? "").slice(0, 3).toLowerCase();
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    return {
      dayIndex: WEEKDAY_INDEX[weekday] ?? now.getDay(),
      minuteOfDay: (Number.isFinite(hour) ? hour % 24 : now.getHours()) * 60 + (Number.isFinite(minute) ? minute : now.getMinutes()),
    };
  } catch {
    return { dayIndex: now.getDay(), minuteOfDay: now.getHours() * 60 + now.getMinutes() };
  }
}

function isPointInsideWeeklyInterval(point: number, start: number, end: number): boolean {
  // Also compare point + WEEK_MINUTES so Saturday overnight intervals can cover
  // the first minutes of Sunday in the same normalized calculation.
  return (point >= start && point <= end) || (point + WEEK_MINUTES >= start && point + WEEK_MINUTES <= end);
}

export function isWithinSchedule(
  hours: OpeningHours,
  now: Date = new Date(),
  timeZone: string = DEFAULT_RESTAURANT_TIME_ZONE,
): boolean {
  if (!hours || Object.keys(hours).length === 0) return true; // no schedule → assume open

  const { dayIndex, minuteOfDay } = getZonedNow(now, timeZone);
  const nowPoint = dayIndex * 24 * 60 + minuteOfDay;

  let hasConfiguredSchedule = false;

  for (let i = 0; i < DAY_KEYS.length; i += 1) {
    const day = hours[DAY_KEYS[i]];
    if (!day) continue;
    hasConfiguredSchedule = true;
    if (day.enabled === false) continue;

    const shifts: Array<[string | null | undefined, string | null | undefined]> = [
      [day.open, day.close],
      [day.open2, day.close2],
    ];

    for (const [open, close] of shifts) {
      const openMin = parseTime(open);
      const closeMin = parseTime(close);
      if (openMin === null || closeMin === null) continue;

      let start = i * 24 * 60 + openMin;
      let end = i * 24 * 60 + closeMin;
      if (end <= start) end += 24 * 60; // overnight shift

      if (isPointInsideWeeklyInterval(nowPoint, start, end)) return true;
    }
  }

  // If opening_hours is a malformed object with no recognizable day schedules,
  // keep the historical behavior: do not unexpectedly close the restaurant.
  if (!hasConfiguredSchedule) return true;
  return false;
}

export type RestaurantStatus = {
  isOpen: boolean;
  reason: "manual_closed" | "off_schedule" | "open";
  manualStatus: boolean;
  withinSchedule: boolean;
  timeZone: string;
};

export function getRestaurantStatus(input: {
  is_open?: boolean | null;
  opening_hours?: OpeningHours;
  timeZone?: string | null;
}, now: Date = new Date()): RestaurantStatus {
  const timeZone = input.timeZone || DEFAULT_RESTAURANT_TIME_ZONE;
  const manualStatus = input.is_open !== false; // null/undefined treated as open
  const withinSchedule = isWithinSchedule(input.opening_hours, now, timeZone);

  if (!manualStatus) {
    return { isOpen: false, reason: "manual_closed", manualStatus, withinSchedule, timeZone };
  }
  if (!withinSchedule) {
    return { isOpen: false, reason: "off_schedule", manualStatus, withinSchedule, timeZone };
  }
  return { isOpen: true, reason: "open", manualStatus, withinSchedule, timeZone };
}
