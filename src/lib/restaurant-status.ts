// Single source of truth for restaurant open/closed status.
// Rule:
//  1. If the owner has manually closed (is_open === false) → always Closed.
//  2. Otherwise check today's schedule in opening_hours.
//     - No schedule at all → treat as Open (owner hasn't configured hours).
//     - Day disabled or outside shifts → Closed.
//     - Inside shift 1 or shift 2 → Open.

export type DayHours = {
  enabled?: boolean;
  open?: string | null;
  close?: string | null;
  open2?: string | null;
  close2?: string | null;
};

export type OpeningHours = Record<string, DayHours> | null | undefined;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function inShift(currMin: number, open?: string | null, close?: string | null): boolean {
  if (!open || !close) return false;
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  if ([oh, om, ch, cm].some((n) => Number.isNaN(n))) return false;
  const a = oh * 60 + om;
  const b = ch * 60 + cm;
  return b > a ? currMin >= a && currMin <= b : currMin >= a || currMin <= b;
}

export function isWithinSchedule(hours: OpeningHours, now: Date = new Date()): boolean {
  if (!hours || Object.keys(hours).length === 0) return true; // no schedule → assume open
  const day = hours[DAY_KEYS[now.getDay()]];
  if (!day) return true;
  if (day.enabled === false) return false;
  const curr = now.getHours() * 60 + now.getMinutes();
  return inShift(curr, day.open, day.close) || inShift(curr, day.open2, day.close2);
}

export type RestaurantStatus = {
  isOpen: boolean;
  reason: "manual_closed" | "off_schedule" | "open";
  manualStatus: boolean;
  withinSchedule: boolean;
};

export function getRestaurantStatus(input: {
  is_open?: boolean | null;
  opening_hours?: OpeningHours;
}, now: Date = new Date()): RestaurantStatus {
  const manualStatus = input.is_open !== false; // null/undefined treated as open
  const withinSchedule = isWithinSchedule(input.opening_hours, now);

  if (!manualStatus) {
    return { isOpen: false, reason: "manual_closed", manualStatus, withinSchedule };
  }
  if (!withinSchedule) {
    return { isOpen: false, reason: "off_schedule", manualStatus, withinSchedule };
  }
  return { isOpen: true, reason: "open", manualStatus, withinSchedule };
}
