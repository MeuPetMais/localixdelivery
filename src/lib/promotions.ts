// Shared helpers for promotion rules.
// A promotion is considered "active now" when:
//  - promo_price is set, > 0, and lower than the regular price
//  - is_available is true (so the product can be sold)
//  - current time is within [promo_starts_at, promo_ends_at] (either bound may be null)

export type PromoLike = {
  is_available?: boolean | null;
  price: number | string;
  promo_price: number | string | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
};

export function isPromoActiveNow(item: PromoLike, now: Date = new Date()): boolean {
  if (item.is_available === false) return false;
  const price = Number(item.price);
  const promo = item.promo_price == null ? null : Number(item.promo_price);
  if (!promo || promo <= 0 || promo >= price) return false;
  const t = now.getTime();
  if (item.promo_starts_at && t < new Date(item.promo_starts_at).getTime()) return false;
  if (item.promo_ends_at && t > new Date(item.promo_ends_at).getTime()) return false;
  return true;
}

export type PromoStatus = "active" | "scheduled" | "ended" | "inactive";

export function promoStatus(item: PromoLike, now: Date = new Date()): PromoStatus {
  const price = Number(item.price);
  const promo = item.promo_price == null ? null : Number(item.promo_price);
  if (!promo || promo <= 0 || promo >= price) return "inactive";
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
