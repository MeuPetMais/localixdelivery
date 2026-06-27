// Shared helpers for promotion rules.
// A promotion is considered "active now" when:
//  - promo_price is set, > 0, lower than the regular price
//  - is_available is true and is_paused is false
//  - current time is within [promo_starts_at, promo_ends_at] (either bound may be null)
//  - if recurrence_days is set, today's weekday is included (0=Sun..6=Sat)
//  - if recurrence_start_time / recurrence_end_time is set, current time-of-day is inside the window

export type PromoLike = {
  is_available?: boolean | null;
  is_paused?: boolean | null;
  price: number | string;
  promo_price: number | string | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  recurrence_days?: number[] | null;
  recurrence_start_time?: string | null; // "HH:MM[:SS]"
  recurrence_end_time?: string | null;
};

export type PromoStatus = "active" | "scheduled" | "ended" | "paused" | "inactive";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function inRecurrenceWindow(item: PromoLike, now: Date): boolean {
  if (item.recurrence_days && item.recurrence_days.length > 0) {
    if (!item.recurrence_days.includes(now.getDay())) return false;
  }
  if (item.recurrence_start_time && item.recurrence_end_time) {
    const cur = now.getHours() * 60 + now.getMinutes();
    const s = timeToMinutes(item.recurrence_start_time);
    const e = timeToMinutes(item.recurrence_end_time);
    if (s <= e) {
      if (cur < s || cur > e) return false;
    } else {
      // window crosses midnight
      if (cur < s && cur > e) return false;
    }
  }
  return true;
}

export function isPromoActiveNow(item: PromoLike, now: Date = new Date()): boolean {
  if (item.is_available === false) return false;
  if (item.is_paused === true) return false;
  const price = Number(item.price);
  const promo = item.promo_price == null ? null : Number(item.promo_price);
  if (!promo || promo <= 0 || promo >= price) return false;
  const t = now.getTime();
  if (item.promo_starts_at && t < new Date(item.promo_starts_at).getTime()) return false;
  if (item.promo_ends_at && t > new Date(item.promo_ends_at).getTime()) return false;
  if (!inRecurrenceWindow(item, now)) return false;
  return true;
}

export function promoStatus(item: PromoLike, now: Date = new Date()): PromoStatus {
  const price = Number(item.price);
  const promo = item.promo_price == null ? null : Number(item.promo_price);
  if (!promo || promo <= 0 || promo >= price) return "inactive";
  if (item.is_paused) return "paused";
  const t = now.getTime();
  if (item.promo_starts_at && t < new Date(item.promo_starts_at).getTime()) return "scheduled";
  if (item.promo_ends_at && t > new Date(item.promo_ends_at).getTime()) return "ended";
  return "active";
}

export function discountPct(item: PromoLike): number {
  const price = Number(item.price);
  const promo = item.promo_price == null ? null : Number(item.promo_price);
  if (!promo || !price) return 0;
  return Math.round((1 - promo / price) * 100);
}

export const WEEKDAYS = [
  { value: 0, label: "Dom", full: "Domingo" },
  { value: 1, label: "Seg", full: "Segunda" },
  { value: 2, label: "Ter", full: "Terça" },
  { value: 3, label: "Qua", full: "Quarta" },
  { value: 4, label: "Qui", full: "Quinta" },
  { value: 5, label: "Sex", full: "Sexta" },
  { value: 6, label: "Sáb", full: "Sábado" },
];

export const CAMPAIGN_TEMPLATES: { label: string; emoji: string; suggest?: { percent?: number; days?: number[]; start?: string; end?: string } }[] = [
  { label: "Promoção do Dia", emoji: "🔥", suggest: { percent: 15 } },
  { label: "Happy Hour", emoji: "🍻", suggest: { percent: 20, start: "18:00", end: "20:00" } },
  { label: "Terça da Pizza", emoji: "🍕", suggest: { percent: 30, days: [2] } },
  { label: "Quinta do Hambúrguer", emoji: "🍔", suggest: { percent: 25, days: [4] } },
  { label: "Combo Especial", emoji: "🥤", suggest: { percent: 20 } },
  { label: "Aniversário da Loja", emoji: "🎉", suggest: { percent: 40 } },
  { label: "Black Friday", emoji: "🛒", suggest: { percent: 50 } },
  { label: "Natal", emoji: "🎄", suggest: { percent: 20 } },
  { label: "Dia dos Namorados", emoji: "❤️", suggest: { percent: 20 } },
  { label: "Fim de Semana", emoji: "🎊", suggest: { percent: 15, days: [5, 6, 0] } },
];
