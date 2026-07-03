// ScheduleEngine — pure scheduling math. Persistence lives in
// reports.functions; delivery integration happens via NotificationCenter.
import type { ScheduleFrequency } from "./types";

export class ScheduleEngine {
  static nextExecution(freq: ScheduleFrequency, from: Date = new Date()): Date {
    const d = new Date(from);
    switch (freq) {
      case "daily":   d.setDate(d.getDate() + 1); break;
      case "weekly":  d.setDate(d.getDate() + 7); break;
      case "monthly": d.setMonth(d.getMonth() + 1); break;
      case "custom":  d.setDate(d.getDate() + 1); break;
    }
    d.setHours(6, 0, 0, 0);
    return d;
  }

  static isDue(next: string | null, at: Date = new Date()): boolean {
    if (!next) return false;
    return new Date(next).getTime() <= at.getTime();
  }
}
