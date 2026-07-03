import type { ComparisonPreset, DateRange } from "./types";

const DAY = 86400000;

function iso(d: Date) { return d.toISOString(); }
function startOfDay(d: Date) { const x = new Date(d); x.setUTCHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setUTCHours(23,59,59,999); return x; }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY); }

export const DateRangeService = {
  today(): DateRange {
    const now = new Date();
    return { from: iso(startOfDay(now)), to: iso(endOfDay(now)) };
  },
  yesterday(): DateRange {
    const y = addDays(new Date(), -1);
    return { from: iso(startOfDay(y)), to: iso(endOfDay(y)) };
  },
  lastNDays(n: number): DateRange {
    const now = new Date();
    return { from: iso(startOfDay(addDays(now, -n + 1))), to: iso(endOfDay(now)) };
  },
  spanDays(range: DateRange): number {
    return Math.max(1, Math.round((+new Date(range.to) - +new Date(range.from)) / DAY));
  },
  compareRange(range: DateRange, preset: ComparisonPreset, custom?: DateRange): DateRange {
    if (preset === "custom" && custom) return custom;
    const from = new Date(range.from);
    const to = new Date(range.to);
    switch (preset) {
      case "today_vs_yesterday": {
        const y = addDays(from, -1);
        return { from: iso(startOfDay(y)), to: iso(endOfDay(y)) };
      }
      case "week_vs_week":
        return { from: iso(addDays(from, -7)), to: iso(addDays(to, -7)) };
      case "month_vs_month":
        return { from: iso(addDays(from, -30)), to: iso(addDays(to, -30)) };
      case "year_vs_year":
        return { from: iso(addDays(from, -365)), to: iso(addDays(to, -365)) };
      default:
        return { from: iso(addDays(from, -DateRangeService.spanDays(range))), to: range.from };
    }
  },
};
