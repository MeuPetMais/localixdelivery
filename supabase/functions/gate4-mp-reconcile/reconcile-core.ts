// Gate 4 diagnostic-only contract. No token, payer details or raw gateway payload in output.
export const GATE4_PROJECT = "https://gvozcqyjhogmvebrwzap.supabase.co";
export const GATE4_RESTAURANT = "1e271104-299c-44b6-98f5-d8effaef3f0a";
export const GATE4_ORDER = "5d047914-5ae0-4bab-9549-465e5d376317";
export const GATE4_SELLER = "3845624814";
export const GATE4_IDEMPOTENCY = "localix-mp-pix-5d047914-5ae0-4bab-9549-465e5d376317";
const MAX_RESULTS = 50;
const MAX_PAGES = 4;

export function searchUrl(offset: number): string {
  if (!Number.isInteger(offset) || offset < 0 || offset >= MAX_RESULTS * MAX_PAGES)
    throw new Error("invalid_page_offset");
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("external_reference", GATE4_ORDER);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  url.searchParams.set("limit", String(MAX_RESULTS));
  url.searchParams.set("offset", String(offset));
  return url.toString();
}

export type SanitizedPayment = {
  id: string;
  status: string;
  amount: number;
  external_reference: string;
  currency_id: string | null;
  date_created: string | null;
};
export function sanitizePayments(body: unknown): {
  payments: SanitizedPayment[];
  total: number;
  count: number;
} {
  if (!body || typeof body !== "object") throw new Error("invalid_gateway_response");
  const obj = body as Record<string, unknown>;
  const paging = obj.paging as Record<string, unknown> | undefined;
  if (!paging || !Number.isSafeInteger(paging.total) || Number(paging.total) < 0 ||
      !Array.isArray(obj.results)) throw new Error("invalid_gateway_response");
  const payments = obj.results.map((item): SanitizedPayment => {
    if (!item || typeof item !== "object") throw new Error("invalid_gateway_payment");
    const p = item as Record<string, unknown>;
    const id = String(p.id ?? "");
    const amount = Number(p.transaction_amount);
    if (!/^\d+$/.test(id) || !Number.isFinite(amount) || amount < 0 ||
      p.external_reference !== GATE4_ORDER || typeof p.status !== "string") {
      throw new Error("invalid_gateway_payment");
    }
    return {
      id,
      status: p.status,
      amount,
      external_reference: GATE4_ORDER,
      currency_id: typeof p.currency_id === "string" ? p.currency_id : null,
      date_created: typeof p.date_created === "string" ? p.date_created : null,
    };
  });
  if (payments.length > MAX_RESULTS || payments.length > Number(paging.total))
    throw new Error("invalid_gateway_pagination");
  return { payments, count: payments.length, total: Number(paging.total) };
}

export function remainingPages(total: number): number {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("invalid_gateway_total");
  return Math.min(Math.ceil(total / MAX_RESULTS), MAX_PAGES);
}

export function completeSearch(total: number, count: number): boolean {
  return total <= MAX_PAGES * MAX_RESULTS && count === total;
}
